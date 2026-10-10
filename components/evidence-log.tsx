"use client";

import { useRef, useState } from "react";
import { Camera, MapPin, Trash2, TriangleAlert } from "lucide-react";
import {
  addEvidence,
  removeEvidence,
  updateEvidenceCaption,
  type EvidenceEntry,
  type EvidenceGpsSource,
} from "@/lib/field-store";

const THUMB_MAX_PX = 320;

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** Downscale to a small JPEG so dozens of photos fit in localStorage. */
function makeThumbnail(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, THUMB_MAX_PX / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unsupported image format"));
    };
    img.src = url;
  });
}

type ExifResult = {
  lat: number | null;
  lon: number | null;
  takenAt: string | null;
};

async function readExif(file: File): Promise<ExifResult> {
  try {
    const { default: exifr } = await import("exifr");
    const data = await exifr.parse(file, {
      gps: true,
      pick: ["latitude", "longitude", "DateTimeOriginal"],
    });
    const lat = typeof data?.latitude === "number" ? data.latitude : null;
    const lon = typeof data?.longitude === "number" ? data.longitude : null;
    const taken = data?.DateTimeOriginal;
    return {
      lat,
      lon,
      takenAt: taken instanceof Date ? taken.toISOString() : null,
    };
  } catch {
    return { lat: null, lon: null, takenAt: null };
  }
}

function readDeviceGps(): Promise<GeolocationPosition | null> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  });
}

function formatCoord(entry: EvidenceEntry): string {
  if (entry.lat === null || entry.lon === null) return "No location";
  return `${entry.lat.toFixed(5)}, ${entry.lon.toFixed(5)}`;
}

const GPS_SOURCE_LABEL: Record<Exclude<EvidenceGpsSource, null>, string> = {
  "photo-exif": "Photo EXIF",
  device: "Device GPS",
};

export function EvidenceLog({
  evidence,
  cardClass,
  labelClass,
}: {
  evidence: EvidenceEntry[];
  cardClass: string;
  labelClass: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const [thumb, exif] = await Promise.all([
          makeThumbnail(file),
          readExif(file),
        ]);
        let lat = exif.lat;
        let lon = exif.lon;
        let accuracyM: number | null = null;
        let gpsSource: EvidenceGpsSource = lat !== null ? "photo-exif" : null;

        // iOS strips EXIF GPS from uploads unless location is shared, so
        // fall back to where the iPad is right now.
        if (lat === null || lon === null) {
          const pos = await readDeviceGps();
          if (pos) {
            lat = pos.coords.latitude;
            lon = pos.coords.longitude;
            accuracyM = Math.round(pos.coords.accuracy);
            gpsSource = "device";
          }
        }

        addEvidence({
          id: newId(),
          caption: "",
          loggedAt: new Date().toISOString(),
          photoTakenAt: exif.takenAt,
          lat,
          lon,
          accuracyM,
          gpsSource,
          thumb,
        });
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? `Could not add photo: ${err.message}`
          : "Could not add photo.",
      );
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const geotagged = evidence.filter((e) => e.lat !== null).length;

  return (
    <div className={cardClass}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg leading-tight text-ink">
            Field Evidence Log
          </h3>
          <p className="text-sm text-stone-500">
            Geotagged photos for HSP reimbursement and audits
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-vine-100 px-3 py-1 text-xs font-semibold text-vine-700">
          {geotagged}/{evidence.length} geotagged
        </span>
      </div>

      <label className={labelClass} htmlFor="evidence-input">
        Add photo evidence
      </label>
      <input
        ref={inputRef}
        id="evidence-input"
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-dashed border-vine-500/60 bg-vine-100/50 px-6 py-4 text-lg font-semibold text-vine-700 transition hover:bg-vine-100 disabled:cursor-wait disabled:opacity-60"
      >
        <Camera className="size-5" />
        {busy ? "Reading location…" : "Take or choose photo"}
      </button>
      <p className="mt-2 text-sm text-stone-500">
        Cover crop stands, compost deliveries, seed receipts. Saved on this
        device and works without signal.
      </p>

      {error && (
        <p className="mt-3 flex items-center gap-2 text-sm font-medium text-burgundy-700">
          <TriangleAlert className="size-4 shrink-0" />
          {error}
        </p>
      )}

      {evidence.length > 0 && (
        <ul className="mt-5 space-y-3">
          {evidence
            .slice()
            .reverse()
            .map((entry) => (
              <li
                key={entry.id}
                className="flex gap-3 rounded-xl border border-earth-300/70 bg-cream p-3"
              >
                {/* Data-URL thumbnails are local, so next/image adds nothing here. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={entry.thumb}
                  alt={entry.caption || "Field evidence photo"}
                  className="size-20 shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <input
                    type="text"
                    value={entry.caption}
                    onChange={(e) =>
                      updateEvidenceCaption(entry.id, e.target.value)
                    }
                    placeholder="Caption, e.g. Legume mix stand, row 12"
                    aria-label="Evidence caption"
                    className="w-full rounded-lg border border-earth-300 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-vine-500 focus:ring-2 focus:ring-vine-100"
                  />
                  <p
                    className={`mt-1.5 flex items-center gap-1.5 text-xs font-medium ${
                      entry.lat !== null ? "text-vine-700" : "text-amber-700"
                    }`}
                  >
                    <MapPin className="size-3.5 shrink-0" />
                    <span className="truncate">
                      {formatCoord(entry)}
                      {entry.gpsSource &&
                        ` · ${GPS_SOURCE_LABEL[entry.gpsSource]}`}
                      {entry.accuracyM !== null && ` ±${entry.accuracyM} m`}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-stone-500">
                    {new Date(entry.photoTakenAt ?? entry.loggedAt).toLocaleString(
                      "en-US",
                      { dateStyle: "medium", timeStyle: "short" },
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeEvidence(entry.id)}
                  aria-label="Remove evidence"
                  className="grid size-10 shrink-0 place-items-center self-start rounded-lg text-stone-400 transition hover:bg-burgundy-50 hover:text-burgundy-700"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
