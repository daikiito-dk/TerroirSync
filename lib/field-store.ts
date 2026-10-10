/**
 * On-device field data store.
 *
 * The vineyard profile, activity inputs, and evidence log persist to
 * localStorage so the dashboard keeps working offline in the field —
 * no network, no backend, data stays on the iPad.
 *
 * Exposed as an external store for React's useSyncExternalStore: hydration
 * renders with defaults (server snapshot), then switches to the persisted
 * client snapshot after hydration.
 */

export type CoverCrop = "perennial-mix" | "legume-mix" | "none";
export type UnderVineManagement =
  | "shallow-tillage"
  | "herbicide"
  | "sheep-grazing";

export type EvidenceGpsSource = "photo-exif" | "device" | null;

export type EvidenceEntry = {
  id: string;
  caption: string;
  /** ISO timestamp of when the evidence was logged in TerroirSync. */
  loggedAt: string;
  /** EXIF DateTimeOriginal of the photo, when available. */
  photoTakenAt: string | null;
  lat: number | null;
  lon: number | null;
  /** Device GPS accuracy in meters, when device GPS was used. */
  accuracyM: number | null;
  gpsSource: EvidenceGpsSource;
  /** Downscaled JPEG dataURL thumbnail (kept small for localStorage). */
  thumb: string;
};

export type FieldState = {
  vineyardName: string;
  blockId: string;
  acresInput: string;
  coverCrop: CoverCrop;
  underVine: UnderVineManagement;
  diesel: number;
  evidence: EvidenceEntry[];
};

export const DEFAULT_FIELD: FieldState = {
  vineyardName: "Oak Knoll Estate Vineyard",
  blockId: "Block 4 — Cabernet Sauvignon",
  acresInput: "12.5",
  coverCrop: "perennial-mix",
  underVine: "shallow-tillage",
  diesel: 85,
  evidence: [],
};

const STORAGE_KEY = "terroirsync:field:v1";

let snapshot: FieldState = DEFAULT_FIELD;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function loadField(): FieldState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FIELD;
    const parsed = JSON.parse(raw) as Partial<FieldState> | null;
    if (!parsed || typeof parsed !== "object") return DEFAULT_FIELD;
    return {
      ...DEFAULT_FIELD,
      ...parsed,
      evidence: Array.isArray(parsed.evidence) ? parsed.evidence : [],
    };
  } catch {
    return DEFAULT_FIELD;
  }
}

/** Debounced write — typing in a field shouldn't stringify photos per keystroke. */
function schedulePersist() {
  if (saveTimer !== undefined) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      /* Storage quota exceeded — keep working in memory. */
    }
  }, 200);
}

function emit() {
  for (const listener of listeners) listener();
}

if (typeof window !== "undefined") {
  snapshot = loadField();
  // Keep multiple open tabs (e.g. iPad + office desktop) in sync.
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    snapshot = loadField();
    emit();
  });
}

export function subscribeField(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getFieldSnapshot(): FieldState {
  return snapshot;
}

export function getFieldServerSnapshot(): FieldState {
  return DEFAULT_FIELD;
}

export function updateField(partial: Partial<FieldState>) {
  snapshot = { ...snapshot, ...partial };
  schedulePersist();
  emit();
}

export function addEvidence(entry: EvidenceEntry) {
  snapshot = { ...snapshot, evidence: [...snapshot.evidence, entry] };
  schedulePersist();
  emit();
}

export function updateEvidenceCaption(id: string, caption: string) {
  snapshot = {
    ...snapshot,
    evidence: snapshot.evidence.map((entry) =>
      entry.id === id ? { ...entry, caption } : entry,
    ),
  };
  schedulePersist();
  emit();
}

export function removeEvidence(id: string) {
  snapshot = {
    ...snapshot,
    evidence: snapshot.evidence.filter((entry) => entry.id !== id),
  };
  schedulePersist();
  emit();
}

export function resetField() {
  snapshot = DEFAULT_FIELD;
  schedulePersist();
  emit();
}
