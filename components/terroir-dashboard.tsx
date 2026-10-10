"use client";

import {
  useMemo,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  Check,
  CloudSun,
  Copy,
  FileJson,
  FileText,
  Landmark,
  Leaf,
  MapPin,
  Sprout,
  Tractor,
  TriangleAlert,
  Wifi,
  WifiOff,
} from "lucide-react";
import { EvidenceLog } from "@/components/evidence-log";
import {
  getFieldServerSnapshot,
  getFieldSnapshot,
  subscribeField,
  updateField,
  type CoverCrop,
  type UnderVineManagement,
} from "@/lib/field-store";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/* ------------------------------------------------------------------ */
/* Mock coefficients & option catalogs (prototype data)                */
/* ------------------------------------------------------------------ */

const CARBON_PER_ACRE_TCO2E = 1.63; // tCO2e/acre/yr — perennial crop (mock)
const HSP_RATE_PER_ACRE_USD = 153; // USD/acre — CDFA HSP cover-crop rate (mock)
const DIESEL_TCO2E_PER_GALLON = 0.0102; // tCO2e/gal of off-road diesel (mock)
const DIESEL_SLIDER_MAX = 400; // gallons/block/month

const COVER_CROP_OPTIONS: { value: CoverCrop; label: string; note: string }[] = [
  {
    value: "perennial-mix",
    label: "Perennial Mix",
    note: "Resident cover crop — builds soil carbon every season.",
  },
  {
    value: "legume-mix",
    label: "Legume Mix",
    note: "Fixes nitrogen — reduces synthetic fertilizer needs.",
  },
  {
    value: "none",
    label: "None (Bare Ground)",
    note: "Bare alleyways — HSP cover-crop incentive not available.",
  },
];

const UNDER_VINE_OPTIONS: {
  value: UnderVineManagement;
  label: string;
  note: string;
}[] = [
  {
    value: "shallow-tillage",
    label: "Shallow Tillage",
    note: "Shallow cultivation — reduced-tillage practice.",
  },
  {
    value: "herbicide",
    label: "Herbicide",
    note: "Chemical strip — flagged by Napa Green standards.",
  },
  {
    value: "sheep-grazing",
    label: "Sheep Grazing",
    note: "Grazing undervine — no-tillage, auditor favorite.",
  },
];

const COVER_CROP_LABELS: Record<CoverCrop, string> = {
  "perennial-mix": "Perennial Mix",
  "legume-mix": "Legume Mix",
  none: "None (Bare Ground)",
};

const TILLAGE_PRACTICE: Record<UnderVineManagement, string> = {
  "shallow-tillage": "reduced-tillage-shallow-cultivation",
  herbicide: "conventional-herbicide-strip",
  "sheep-grazing": "grazing-no-tillage",
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/* ------------------------------------------------------------------ */
/* Compliance model (mock Napa Green readiness)                        */
/* ------------------------------------------------------------------ */

type ComplianceTone = "green" | "amber" | "red";

const STATUS_STYLES: Record<ComplianceTone, string> = {
  green: "bg-vine-100 text-vine-700 border-vine-500/40",
  amber: "bg-amber-50 text-amber-700 border-amber-400/60",
  red: "bg-burgundy-100 text-burgundy-700 border-burgundy-500/40",
};

const STATUS_ICONS: Record<ComplianceTone, LucideIcon> = {
  green: BadgeCheck,
  amber: TriangleAlert,
  red: TriangleAlert,
};

/* ------------------------------------------------------------------ */
/* Small presentational helpers                                        */
/* ------------------------------------------------------------------ */

const inputClass =
  "w-full rounded-xl border border-earth-300 bg-white px-4 py-3 text-lg text-ink shadow-[inset_0_1px_2px_rgba(43,36,28,0.06)] outline-none transition placeholder:text-stone-400 focus:border-vine-500 focus:ring-4 focus:ring-vine-100";

const labelClass =
  "mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-earth-700";

const cardClass =
  "rounded-2xl border border-earth-300/70 bg-white p-6 shadow-[0_8px_30px_rgba(91,26,40,0.07)]";

/* SSR-safe "is hydrated" flag: false on the server, true on the client. */
const emptySubscribe = () => () => {};

function useIsHydrated() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function useIsOnline() {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

function PaneHeader({
  icon: Icon,
  title,
  subtitle,
  accent,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  accent: string;
}) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <div className={`grid size-10 shrink-0 place-items-center rounded-xl ${accent}`}>
        <Icon className="size-5" />
      </div>
      <div>
        <h2 className="font-display text-xl leading-tight text-ink">{title}</h2>
        <p className="text-sm text-stone-500">{subtitle}</p>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  accent,
  children,
  footnote,
}: {
  icon: LucideIcon;
  label: string;
  accent: string;
  children: React.ReactNode;
  footnote: React.ReactNode;
}) {
  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between gap-4">
        <p className={`text-xs font-bold uppercase tracking-[0.14em] ${accent}`}>
          {label}
        </p>
        <Icon className={`size-5 ${accent}`} />
      </div>
      <div className="mt-3">{children}</div>
      <p className="mt-3 text-sm leading-snug text-stone-500">{footnote}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard SPA                                                       */
/* ------------------------------------------------------------------ */

export default function TerroirDashboard() {
  const field = useSyncExternalStore(
    subscribeField,
    getFieldSnapshot,
    getFieldServerSnapshot,
  );
  const { vineyardName, blockId, acresInput, coverCrop, underVine, diesel, evidence } =
    field;
  const [copied, setCopied] = useState(false);
  const mounted = useIsHydrated();
  const online = useIsOnline();

  /* ---- derived metrics (recomputed on every keystroke) ---- */

  const acres = Number.parseFloat(acresInput) || 0;
  const annualCarbon = acres * CARBON_PER_ACRE_TCO2E;
  const grantEligibility =
    coverCrop === "none" ? 0 : acres * HSP_RATE_PER_ACRE_USD;
  const annualDieselGallons = diesel * 12;
  const dieselEmissions = annualDieselGallons * DIESEL_TCO2E_PER_GALLON;
  const netCarbon = annualCarbon - dieselEmissions;
  const profileComplete =
    vineyardName.trim() !== "" && blockId.trim() !== "" && acres > 0;

  const compliance: {
    status: string;
    tone: ComplianceTone;
    detail: string;
  } = !profileComplete
    ? {
        status: "Missing Data",
        tone: "amber",
        detail: "Complete the vineyard profile on the left to unlock audit readiness.",
      }
    : underVine === "herbicide"
      ? {
          status: "Audit Risk",
          tone: "red",
          detail:
            "Under-vine herbicide conflicts with Napa Green pesticide standards — switch practices or document a phase-out plan.",
        }
      : {
          status: "Ready for Audit",
          tone: "green",
          detail: "All required field data is logged. Napa Green report unlocked.",
        };

  const checklist = [
    { label: "Vineyard profile complete", ok: profileComplete },
    { label: "Alleyway cover crop documented", ok: true },
    { label: "Under-vine practice Napa Green compliant", ok: underVine !== "herbicide" },
    { label: "Monthly fuel usage logged", ok: true },
    {
      label: "Geotagged field evidence on file",
      ok: evidence.some((e) => e.lat !== null),
    },
  ];

  const evidenceSummary = useMemo(
    () =>
      evidence.map((e) => ({
        id: e.id,
        caption: e.caption.trim() || null,
        capturedAt: e.photoTakenAt ?? e.loggedAt,
        location:
          e.lat !== null && e.lon !== null
            ? {
                lat: Number(e.lat.toFixed(6)),
                lon: Number(e.lon.toFixed(6)),
                source: e.gpsSource,
                accuracyM: e.accuracyM,
              }
            : null,
      })),
    [evidence],
  );

  const chartData = useMemo(() => {
    const monthlyAvg = annualCarbon / 12;
    return MONTHS.map((month, i) => {
      const seasonality =
        1 + 0.35 * Math.sin(((i - 2) / 12) * Math.PI * 2); // peak mid-summer
      return { month, tco2e: Number((monthlyAvg * seasonality).toFixed(2)) };
    });
  }, [annualCarbon]);

  /* ---- COMET-Planner payload (live JSON) ---- */

  const payloadJson = useMemo(() => {
    const payload = {
      source: "TerroirSync",
      version: "0.1.0-mvp",
      generatedAt: mounted ? new Date().toISOString() : "awaiting-device-clock",
      vineyard: {
        name: vineyardName.trim() || null,
        blockId: blockId.trim() || null,
        blockSizeAcres: acres,
        appellation: "Napa Valley (mock)",
      },
      practices: {
        alleywayCoverCrop: coverCrop,
        coverCropType: COVER_CROP_LABELS[coverCrop],
        underVineManagement: underVine,
        tillagePractice: TILLAGE_PRACTICE[underVine],
      },
      fuelUsage: {
        monthlyTractorDieselGallons: diesel,
        annualizedGallons: annualDieselGallons,
        estimatedAnnualEmissionsTco2e: Number(dieselEmissions.toFixed(2)),
      },
      carbonAccounting: {
        sequestrationTco2ePerYear: Number(annualCarbon.toFixed(2)),
        netTco2ePerYear: Number(netCarbon.toFixed(2)),
        coefficient: `${CARBON_PER_ACRE_TCO2E} tCO2e/acre/yr (perennial crop, mock)`,
      },
      grant: {
        program: "CDFA Healthy Soils Program (HSP)",
        nrcsPracticeCode: "CPS 340 — Cover Crop",
        estimatedEligibilityUsd: Number(grantEligibility.toFixed(0)),
      },
      evidence: {
        photoCount: evidenceSummary.length,
        geotaggedCount: evidenceSummary.filter((e) => e.location).length,
        items: evidenceSummary,
      },
    };
    return JSON.stringify(payload, null, 2);
  }, [
    mounted,
    evidenceSummary,
    vineyardName,
    blockId,
    acres,
    coverCrop,
    underVine,
    diesel,
    annualDieselGallons,
    dieselEmissions,
    annualCarbon,
    netCarbon,
    grantEligibility,
  ]);

  /* ---- handlers ---- */

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(payloadJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable in this context */
    }
  }

  function handleGenerateReport() {
    alert(
      `Napa Green Report generated for ${
        vineyardName.trim() || "your vineyard"
      } — ${blockId.trim() || "block"} (${acres} acres).\n\nPDF export successful (mock prototype).`,
    );
  }

  const sliderFill = `${Math.min((diesel / DIESEL_SLIDER_MAX) * 100, 100)}%`;
  const StatusIcon = STATUS_ICONS[compliance.tone];

  return (
    <div className="relative min-h-screen overflow-hidden font-sans">
      {/* soft terroir backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -right-32 size-[28rem] rounded-full bg-vine-100/80 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 -left-40 size-[26rem] rounded-full bg-burgundy-50 blur-3xl"
      />

      {/* ---------- header ---------- */}
      <header className="relative z-10 bg-gradient-to-r from-burgundy-800 via-burgundy-700 to-burgundy-600 text-cream shadow-lg">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <div className="grid size-12 place-items-center rounded-2xl bg-cream text-burgundy-700 shadow-md">
              <Sprout className="size-6" />
            </div>
            <div>
              <h1 className="font-display text-3xl leading-none tracking-tight">
                TerroirSync
              </h1>
              <p className="mt-1 text-sm text-burgundy-100">
                Compliance &amp; subsidy automation for premium wine grape
                growers
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <span className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-cream ring-1 ring-white/20">
              <MapPin className="size-4" />
              Napa · Sonoma · Lodi
            </span>
            <span className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-cream ring-1 ring-white/20">
              <CloudSun className="size-4" />
              MVP Prototype
            </span>
          </div>
          <span
            role="status"
            className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ring-1 ${
              online
                ? "bg-vine-100 text-vine-700 ring-vine-500/40"
                : "bg-amber-100 text-amber-800 ring-amber-400/60"
            }`}
          >
            {online ? <Wifi className="size-4" /> : <WifiOff className="size-4" />}
            {online ? "Online · saved on device" : "Offline · saved on device"}
          </span>
        </div>
      </header>

      {/* ---------- main 3-pane dashboard ---------- */}
      <main className="relative z-10 mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* ===== Pane 1 — input ===== */}
          <section className="space-y-6 lg:col-span-4">
            <div className={cardClass}>
              <PaneHeader
                icon={Sprout}
                title="Vineyard Profile & Activity Input"
                subtitle="Field data — log it from the tractor seat"
                accent="bg-vine-100 text-vine-700"
              />

              <div className="space-y-5">
                <div>
                  <label htmlFor="vineyard-name" className={labelClass}>
                    Vineyard Name
                  </label>
                  <input
                    id="vineyard-name"
                    type="text"
                    className={inputClass}
                    value={vineyardName}
                    onChange={(e) => updateField({ vineyardName: e.target.value })}
                    placeholder="e.g. Oak Knoll Estate Vineyard"
                  />
                </div>

                <div>
                  <label htmlFor="block-id" className={labelClass}>
                    Block ID
                  </label>
                  <input
                    id="block-id"
                    type="text"
                    className={inputClass}
                    value={blockId}
                    onChange={(e) => updateField({ blockId: e.target.value })}
                    placeholder="e.g. Block 4 — Cabernet Sauvignon"
                  />
                </div>

                <div>
                  <label htmlFor="block-size" className={labelClass}>
                    Block Size (Acres)
                  </label>
                  <input
                    id="block-size"
                    type="number"
                    min={0}
                    step={0.5}
                    className={inputClass}
                    value={acresInput}
                    onChange={(e) => updateField({ acresInput: e.target.value })}
                    placeholder="0.0"
                  />
                </div>

                <div>
                  <label htmlFor="cover-crop" className={labelClass}>
                    Alleyway Cover Crop
                  </label>
                  <div className="relative">
                    <select
                      id="cover-crop"
                      className={`${inputClass} appearance-none pr-12`}
                      value={coverCrop}
                      onChange={(e) =>
                        updateField({ coverCrop: e.target.value as CoverCrop })
                      }
                    >
                      {COVER_CROP_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <Leaf className="pointer-events-none absolute top-1/2 right-4 size-5 -translate-y-1/2 text-vine-600" />
                  </div>
                  <p className="mt-2 text-sm text-stone-500">
                    {COVER_CROP_OPTIONS.find((o) => o.value === coverCrop)?.note}
                  </p>
                </div>

                <div>
                  <label htmlFor="under-vine" className={labelClass}>
                    Under-Vine Management
                  </label>
                  <div className="relative">
                    <select
                      id="under-vine"
                      className={`${inputClass} appearance-none pr-12`}
                      value={underVine}
                      onChange={(e) =>
                        updateField({
                          underVine: e.target.value as UnderVineManagement,
                        })
                      }
                    >
                      {UNDER_VINE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <Leaf className="pointer-events-none absolute top-1/2 right-4 size-5 -translate-y-1/2 text-vine-600" />
                  </div>
                  <p className="mt-2 text-sm text-stone-500">
                    {UNDER_VINE_OPTIONS.find((o) => o.value === underVine)?.note}
                  </p>
                </div>

                <div>
                  <div className="flex items-end justify-between">
                    <label htmlFor="diesel-slider" className={labelClass}>
                      <span className="flex items-center gap-2">
                        <Tractor className="size-4" />
                        Monthly Tractor Diesel (gal)
                      </span>
                    </label>
                  </div>
                  <div className="flex items-center gap-4">
                    <input
                      id="diesel-slider"
                      type="range"
                      min={0}
                      max={DIESEL_SLIDER_MAX}
                      step={5}
                      value={diesel}
                      onChange={(e) => updateField({ diesel: Number(e.target.value) })}
                      className="terroir-slider flex-1"
                      style={{ "--fill": sliderFill } as CSSProperties}
                    />
                    <input
                      type="number"
                      min={0}
                      max={DIESEL_SLIDER_MAX}
                      step={5}
                      aria-label="Monthly tractor diesel in gallons"
                      className="w-24 rounded-xl border border-earth-300 bg-white py-3 text-center text-lg font-semibold text-ink outline-none transition focus:border-vine-500 focus:ring-4 focus:ring-vine-100"
                      value={diesel}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isNaN(n)) return;
                        updateField({
                          diesel: Math.max(0, Math.min(n, DIESEL_SLIDER_MAX)),
                        });
                      }}
                    />
                  </div>
                  <p className="mt-2 text-sm text-stone-500">
                    {annualDieselGallons.toLocaleString("en-US")} gallons
                    annualized · {dieselEmissions.toFixed(1)} tCO₂e/yr emissions
                    (mock)
                  </p>
                </div>
              </div>
            </div>

            <EvidenceLog
              evidence={evidence}
              cardClass={cardClass}
              labelClass={labelClass}
            />
          </section>

          {/* ===== Pane 2 — live sustainability dashboard ===== */}
          <section className="space-y-6 lg:col-span-5">
            <div className={cardClass}>
              <PaneHeader
                icon={Leaf}
                title="Sustainability & Subsidy Dashboard"
                subtitle="Recomputed live with every input"
                accent="bg-vine-100 text-vine-700"
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Metric
                  icon={Leaf}
                  label="Est. Carbon Fixed"
                  accent="text-vine-600"
                  footnote={`${acres.toLocaleString("en-US")} acres × ${CARBON_PER_ACRE_TCO2E} tCO₂e — perennial crop coefficient (mock)`}
                >
                  <p className="font-display text-4xl font-semibold tracking-tight text-vine-700">
                    {annualCarbon.toFixed(1)}
                    <span className="ml-1 text-lg font-normal text-stone-500">
                      tCO₂e/yr
                    </span>
                  </p>
                </Metric>

                <Metric
                  icon={Landmark}
                  label="CDFA HSP Grant Eligibility"
                  accent="text-burgundy-600"
                  footnote={
                    coverCrop === "none"
                      ? "Plant an alleyway cover crop to unlock the HSP incentive."
                      : `${acres.toLocaleString("en-US")} acres × $${HSP_RATE_PER_ACRE_USD}/acre — HSP cover-crop rate (mock)`
                  }
                >
                  <p className="font-display text-4xl font-semibold tracking-tight text-burgundy-700">
                    ${Math.round(grantEligibility).toLocaleString("en-US")}
                  </p>
                  {coverCrop === "none" && (
                    <p className="mt-1 text-sm font-medium text-amber-600">
                      Cover crop required for HSP
                    </p>
                  )}
                </Metric>
              </div>

              {/* Napa Green compliance */}
              <div className="mt-4 rounded-2xl border border-earth-300/70 bg-parchment/60 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-earth-700">
                    Napa Green Compliance Status
                  </p>
                  <span
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold ${STATUS_STYLES[compliance.tone]}`}
                  >
                    <StatusIcon className="size-4" />
                    {compliance.status}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-snug text-stone-600">
                  {compliance.detail}
                </p>
                <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {checklist.map((item) => (
                    <li
                      key={item.label}
                      className="flex items-center gap-2 text-sm"
                    >
                      {item.ok ? (
                        <Check className="size-4 shrink-0 text-vine-600" />
                      ) : (
                        <TriangleAlert className="size-4 shrink-0 text-amber-600" />
                      )}
                      <span
                        className={
                          item.ok ? "text-stone-600" : "font-medium text-amber-700"
                        }
                      >
                        {item.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* projection chart */}
            <div className={cardClass}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-lg text-ink">
                  Carbon Fixed — 12-Month Projection
                </h3>
                <span className="text-sm font-medium text-stone-500">
                  tCO₂e / month (mock)
                </span>
              </div>
              {mounted ? (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{ top: 6, right: 6, left: -18, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="carbonFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3f6b4a" stopOpacity={0.45} />
                          <stop offset="100%" stopColor="#3f6b4a" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 6"
                        stroke="#c9b48e"
                        strokeOpacity={0.5}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="month"
                        tick={{ fill: "#5f4a2e", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "#5f4a2e", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#2b241c",
                          border: "none",
                          borderRadius: 12,
                          color: "#f3ecdd",
                        }}
                        labelStyle={{ color: "#c9b48e" }}
                        itemStyle={{ color: "#f3ecdd" }}
                      />
                      <Area
                        type="monotone"
                        dataKey="tco2e"
                        name="tCO₂e"
                        stroke="#2e5339"
                        strokeWidth={2.5}
                        fill="url(#carbonFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="grid h-56 place-items-center text-sm text-stone-400">
                  Loading projection…
                </div>
              )}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-earth-300/60 pt-4 text-sm">
                <span className="text-stone-500">
                  Gross sequestration{" "}
                  <strong className="text-vine-700">
                    {annualCarbon.toFixed(1)} tCO₂e
                  </strong>
                </span>
                <span className="text-stone-500">
                  Tractor emissions{" "}
                  <strong className="text-burgundy-600">
                    −{dieselEmissions.toFixed(1)} tCO₂e
                  </strong>
                </span>
                <span className="text-stone-500">
                  Net{" "}
                  <strong className="text-ink">
                    {netCarbon.toFixed(1)} tCO₂e/yr
                  </strong>
                </span>
              </div>
            </div>
          </section>

          {/* ===== Pane 3 — export & payload ===== */}
          <section className="lg:col-span-3">
            <div className={cardClass}>
              <PaneHeader
                icon={FileJson}
                title="Export & API Payload"
                subtitle="Auditor-ready outputs, generated live"
                accent="bg-burgundy-100 text-burgundy-700"
              />

              <button
                type="button"
                onClick={handleGenerateReport}
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-burgundy-700 to-burgundy-600 px-6 py-4 text-lg font-semibold text-cream shadow-md transition hover:from-burgundy-800 hover:to-burgundy-700 hover:shadow-lg focus-visible:ring-4 focus-visible:ring-burgundy-100 active:scale-[0.98]"
              >
                <FileText className="size-5" />
                Generate Napa Green Report
              </button>
              <p className="mt-2 text-center text-sm text-stone-500">
                Mock PDF — full field history formatted for your auditor.
              </p>

              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-earth-700">
                    COMET-Planner JSON Payload
                  </p>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 rounded-lg border border-earth-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-vine-500 hover:text-vine-700"
                  >
                    {copied ? (
                      <>
                        <Check className="size-3.5 text-vine-600" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="size-3.5" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <pre className="max-h-[430px] overflow-auto rounded-xl bg-burgundy-800 p-4 font-mono text-[13px] leading-relaxed text-parchment shadow-inner ring-1 ring-burgundy-900/40">
                  {payloadJson}
                </pre>
                <p className="mt-2 text-sm text-stone-500">
                  Streams into the CDFA HSP application via COMET-Planner field
                  structure.
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* footer */}
        <footer className="mt-10 border-t border-earth-300/60 pt-6 text-center text-sm text-stone-500">
          TerroirSync MVP — mock coefficients for prototyping only. Not an
          official CDFA, Napa Green, or COMET-Planner product.
        </footer>
      </main>
    </div>
  );
}
