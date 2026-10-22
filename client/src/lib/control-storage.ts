// Saved marks + licence/gearbox session for the Controls study module.
// Mirrors rule-storage.ts — plain JSON in localStorage.
// Progress is server-synced for W/M/X codes via progress-sync.ts.

import { syncEnabled, pushProgress, hydrateProgress, recordOwnerIfMissing } from "./progress-sync";
import { isKnown, nextStatus, type LearningStatus, type RecallRating, type LearningRecord } from "./learning-status";

export type { LearningStatus, RecallRating, LearningRecord };
export { isKnown };

const FAV_CONTROLS_KEY = "k53_favorite_controls";
const LEARNING_CONTROLS_KEY = "k53_control_learning";
const CONTROLS_CODE_KEY = "k53_controls_licence_code";
const CONTROLS_GEARBOX_KEY = "k53_controls_gearbox";
const LEGACY_DONE_CONTROLS_KEY = "k53_done_controls";

function readIds(key: string): number[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "number") : [];
  } catch {
    return [];
  }
}
function writeIds(key: string, ids: number[]): void {
  try { localStorage.setItem(key, JSON.stringify(ids)); } catch { /* ignore */ }

}
export function getFavoriteControlIds(): number[] { return readIds(FAV_CONTROLS_KEY); }

export function isFavoriteControl(id: number): boolean {
  return readIds(FAV_CONTROLS_KEY).includes(id);
}

/** Remove the given ids from the saved list. */
export function removeFavoriteControls(ids: number[]): void {
  const drop = new Set(ids);
  writeIds(FAV_CONTROLS_KEY, readIds(FAV_CONTROLS_KEY).filter((id) => !drop.has(id)));
}

/** Toggles saved. Returns true if the control is now saved. */
export function toggleFavoriteControl(id: number): boolean {
  const ids = readIds(FAV_CONTROLS_KEY);
  const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
  writeIds(FAV_CONTROLS_KEY, next);
  return next.includes(id);
}

function readLearningMap(key: string): Record<number, LearningRecord> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}
function writeLearningMap(
  key: string,
  map: Record<number, { status: LearningStatus; correct: number; incorrect: number; lastRating: string; lastSeenAt: string }>
): void {
  try { localStorage.setItem(key, JSON.stringify(map)); } catch { /* ignore */ }
}
export function rateControl(id: number, rating: RecallRating): LearningRecord {
  recordOwnerIfMissing();
  const map = readLearningMap(LEARNING_CONTROLS_KEY);
  const prev = map[id];
  const notYet = rating === "again" || rating === "hard";
  const resolved: RecallRating = notYet ? "again" : "good";
  const record: LearningRecord = {
    status: nextStatus(prev, resolved),
    correct: (prev?.correct ?? 0) + (notYet ? 0 : 1),
    incorrect: (prev?.incorrect ?? 0) + (notYet ? 1 : 0),
    lastRating: resolved,
    lastSeenAt: new Date().toISOString(),
  };
  map[id] = record;
  writeLearningMap(LEARNING_CONTROLS_KEY, map);

  if (syncEnabled()) {
    pushProgress("control", id, record);
  }

  return record;
}

/** "I know this" tick: mark as known, or drop back to to-practise. */
export function setControlKnown(id: number, known: boolean): LearningRecord {
  return rateControl(id, known ? "good" : "again");
}

export function getAllControlLearning(): Record<number, LearningRecord> { return readLearningMap(LEARNING_CONTROLS_KEY); }

/** Remove the learning records for these ids (Reset section). */
export function resetControlProgress(ids: number[]): void {
  recordOwnerIfMissing();
  const drop = new Set(ids);
  const map = readLearningMap(LEARNING_CONTROLS_KEY);
  const removed: number[] = [];
  for (const key of Object.keys(map).map(Number)) {
    if (drop.has(key)) {
      delete map[key];
      removed.push(key);
    }
  }
  writeLearningMap(LEARNING_CONTROLS_KEY, map);

  if (syncEnabled()) {
    for (const id of removed) {
      pushProgress("control", id, {
        status: "new",
        correct: 0,
        incorrect: 0,
        lastRating: "good",
        lastSeenAt: new Date().toISOString(),
      });
    }
  }
}

export function getControlLearning(id: number): LearningRecord | undefined {
  return readLearningMap(LEARNING_CONTROLS_KEY)[id];
}

// === One-time migration: fold the old done tick-lists into known status ===

function migrateDoneControls(): void {
  try {
    const ids = readIds(LEGACY_DONE_CONTROLS_KEY);
    if (ids.length === 0) return;
    const map = readLearningMap(LEARNING_CONTROLS_KEY);
    const marked: number[] = [];
    for (const id of ids) {
      if (isKnown(map[id]?.status)) continue;
      map[id] = {
        status: "mastered",
        correct: (map[id]?.correct ?? 0) + 1,
        incorrect: map[id]?.incorrect ?? 0,
        lastRating: "good",
        lastSeenAt: new Date().toISOString(),
      };
      marked.push(id);
    }
    if (marked.length > 0) writeLearningMap(LEARNING_CONTROLS_KEY, map);
    if (marked.length > 0 && syncEnabled()) {
      for (const id of marked) pushProgress("control", id, map[id]!);
    }
    localStorage.removeItem(LEGACY_DONE_CONTROLS_KEY);
  } catch {
    // ignore — migration retries on next load since the key stays put
  }
}

export type ControlLicenceCode = 1 | 2 | 3;
export function getControlsLicenceCode(): ControlLicenceCode | null {
  try {
    const raw = localStorage.getItem(CONTROLS_CODE_KEY);
    if (raw === "1" || raw === "2" || raw === "3") return parseInt(raw, 10) as ControlLicenceCode;
    return null;
  } catch { return null; }
}
export function setControlsLicenceCode(code: ControlLicenceCode): void {
  try { localStorage.setItem(CONTROLS_CODE_KEY, String(code)); } catch { /* ignore */ }
}
export function clearControlsLicenceCode(): void {
  try { localStorage.removeItem(CONTROLS_CODE_KEY); } catch { /* ignore */ }
}

export type ControlGearbox = "manual" | "automatic";
export function getControlsGearbox(): ControlGearbox | null {
  try {
    const raw = localStorage.getItem(CONTROLS_GEARBOX_KEY);
    if (raw === "manual" || raw === "automatic") return raw;
    return null;
  } catch { return null; }
}
export function setControlsGearbox(g: ControlGearbox): void {
  try { localStorage.setItem(CONTROLS_GEARBOX_KEY, g); } catch { /* ignore */ }
}
export function clearControlsGearbox(): void {
  try { localStorage.removeItem(CONTROLS_GEARBOX_KEY); } catch { /* ignore */ }
}

// Resolve the current session to diagram filters
export function sessionToQuery(): { vehicle_type: string; gearbox?: string } | null {
  const code = getControlsLicenceCode();
  if (code === 1) return { vehicle_type: "motorcycle" };
  const g = getControlsGearbox();
  if (code === 2 && g) return { vehicle_type: "lmv", gearbox: g };
  if (code === 3 && g) return { vehicle_type: "hmv", gearbox: g };
  return null;
}

export function isVehicleTypeForCode(code: number | null, vehicleType: string, gearbox: string | null | undefined): boolean {
  if (code === 1) return vehicleType === "motorcycle";
  if (code === 2) return vehicleType === "lmv";
  if (code === 3) return vehicleType === "hmv";
  return false;
}

/** Hydrate control progress from the server (server authoritative, local uploaded once when empty). */
export async function initControlSync(): Promise<void> {
  migrateDoneControls();
  const local = readLearningMap(LEARNING_CONTROLS_KEY);
  const hydrated = await hydrateProgress("control", local);
  if (hydrated !== null) writeLearningMap(LEARNING_CONTROLS_KEY, hydrated);
}

/** Remove all device-local control progress and bookmarks (logout). */
export function clearControlLocalData(): void {
  try {
    localStorage.removeItem(LEARNING_CONTROLS_KEY);
    localStorage.removeItem(FAV_CONTROLS_KEY);
    localStorage.removeItem(LEGACY_DONE_CONTROLS_KEY);
  } catch {
    // ignore
  }
}
