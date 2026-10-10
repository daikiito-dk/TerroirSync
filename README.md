# TerroirSync

**Compliance & subsidy automation for California premium wine grape growers.**

TerroirSync turns daily vineyard fieldwork — typed once on an iPad — into
auditor-ready sustainability reports (Napa Green, Lodi Rules) and structured
grant-application payloads (CDFA Healthy Soils Program / COMET-Planner).

No more spreadsheets, no more binders of paper for the auditor.

## The one-screen dashboard

| Pane | What it does |
| --- | --- |
| **Vineyard Profile & Activity Input** | Vineyard name, Block ID, block size (acres), alleyway cover crop, under-vine management, monthly tractor diesel (slider + numeric) |
| **Sustainability & Subsidy Dashboard** | Live metrics: Estimated Carbon Fixed (`acres × 1.63 tCO₂e`), CDFA HSP Grant Eligibility (`acres × $153` with cover crop), Napa Green compliance status badge, 12-month carbon projection chart |
| **Export & API Payload** | One-click Napa Green report (mock PDF) and a live COMET-Planner JSON payload (`tillagePractice`, `coverCropType`, `fuelUsage`, …) ready to copy into grant systems |

Everything recalculates in real time as you type or move the slider.

## Mock coefficients (prototype)

- Perennial crop sequestration: **1.63 tCO₂e/acre/yr**
- CDFA HSP cover-crop incentive: **$153/acre**
- Off-road diesel emissions: **0.0102 tCO₂e/gallon**

These are placeholder values for the MVP — production will integrate real
CDFA/NRCS coefficients and the COMET-Planner API.

## Tech stack

- [Next.js](https://nextjs.org) (App Router, TypeScript)
- [Tailwind CSS v4](https://tailwindcss.com) — burgundy / vine / earth palette, sunlight-readable contrast
- [Lucide Icons](https://lucide.dev)
- [Recharts](https://recharts.org) — carbon projection chart

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run build   # production build
npm start       # serve production build
```

## Roadmap

- Multi-block management with per-block history
- Offline-first PWA mode for field entry
- Real COMET-Planner API integration
- Auditor share links with export bundles
- Lodi Rules & SIP checklist templates
