// Saved marks + learning records for the Study modules.
// Same localStorage pattern quiz-context.tsx uses for quiz state —
// plain JSON, no backend changes needed.
// Progress is server-synced for W/M/X codes via progress-sync.ts.

import { syncEnabled, pushProgress, hydrateProgress, recordOwnerIfMissing } from "./progress-sync";
import { isKnown, nextStatus, toCount, deselectKnown, type LearningStatus, type RecallRating, type LearningRecord } from "./learning-status";

export type { LearningStatus, RecallRating, LearningRecord };
export { isKnown };

const FAV_SIGNS_KEY = "k53_favorite_signs";
const LEARNING_SIGNS_KEY = "k53_sign_learning";
const LEGACY_DONE_SIGNS_KEY = "k53_done_signs";

// === Learning records ===

function readLearningMap(key: string): Record<number, LearningRecord> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    return {};
  } catch {
    return {};
  }
}

function writeLearningMap(
  key: string,
  map: Record<number, { status: LearningStatus; correct: number; incorrect: number; lastRating: string; lastSeenAt: string }>
): void {
  try {
    localStorage.setItem(key, JSON.stringify(map));
  } catch {
    // storage full / private mode — study still works, just not persisted
  }
}

function rateLearningRecord(map: Record<number, LearningRecord>, id: number, notYet: boolean): LearningRecord {
  const prev = map[id];
  const rating: RecallRating = notYet ? "again" : "good";
  const record: LearningRecord = {
    status: nextStatus(prev, rating),
    correct: toCount(prev?.correct) + (notYet ? 0 : 1),
    incorrect: toCount(prev?.incorrect) + (notYet ? 1 : 0),
    lastRating: rating,
    lastSeenAt: new Date().toISOString(),
  };
  map[id] = record;
  return record;
}

export function rateSign(id: number, rating: RecallRating): LearningRecord {
  recordOwnerIfMissing();
  const map = readLearningMap(LEARNING_SIGNS_KEY);
  const record = rateLearningRecord(map, id, rating === "again" || rating === "hard");
  writeLearningMap(LEARNING_SIGNS_KEY, map);

  if (syncEnabled()) {
    pushProgress("sign", id, record);
  }

  return record;
}

/** "I know this" tick: mark as known, or drop back to to-practise. */
export function setSignKnown(id: number, known: boolean): LearningRecord {
  return rateSign(id, known ? "good" : "again");
}

export function getSignLearning(id: number): LearningRecord | undefined {
  return readLearningMap(LEARNING_SIGNS_KEY)[id];
}

export function getAllSignLearning(): Record<number, LearningRecord> {
  return readLearningMap(LEARNING_SIGNS_KEY);
}

/** Remove the learning records for these ids (Reset section). */
export function resetSignProgress(ids: number[]): void {
  recordOwnerIfMissing();
  const drop = new Set(ids);
  const map = readLearningMap(LEARNING_SIGNS_KEY);
  const removed: number[] = [];
  for (const key of Object.keys(map).map(Number)) {
    if (drop.has(key)) {
      delete map[key];
      removed.push(key);
    }
  }
  writeLearningMap(LEARNING_SIGNS_KEY, map);

  if (syncEnabled()) {
    for (const id of removed) {
      pushProgress("sign", id, {
        status: "new",
        correct: 0,
        incorrect: 0,
        lastRating: "good",
        lastSeenAt: new Date().toISOString(),
      });
    }
  }
}

/** Mark the learned cards in this section as not learned again (bulk deselect). */
export function deselectSigns(ids: number[]): void {
  recordOwnerIfMissing();
  const map = readLearningMap(LEARNING_SIGNS_KEY);
  const changed = deselectKnown(map, ids);
  if (changed.length === 0) return;
  writeLearningMap(LEARNING_SIGNS_KEY, map);

  if (syncEnabled()) {
    for (const id of changed) {
      pushProgress("sign", id, map[id]!);
    }
  }
}

// === Saved (favorites) ===

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
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // storage full / private mode — study still works, just not persisted
  }
}

export function getFavoriteSignIds(): number[] {
  return readIds(FAV_SIGNS_KEY);
}

export function isFavoriteSign(id: number): boolean {
  return readIds(FAV_SIGNS_KEY).includes(id);
}

/** Remove the given ids from the saved list. */
export function removeFavoriteSigns(ids: number[]): void {
  const drop = new Set(ids);
  writeIds(FAV_SIGNS_KEY, readIds(FAV_SIGNS_KEY).filter((id) => !drop.has(id)));
}

/** Toggles saved. Returns true if the sign is now saved. */
export function toggleFavoriteSign(id: number): boolean {
  const ids = readIds(FAV_SIGNS_KEY);
  const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
  writeIds(FAV_SIGNS_KEY, next);
  return next.includes(id);
}

// === One-time migration: fold the old done tick-lists into known status ===

function migrateDoneSigns(): void {
  try {
    const ids = readIds(LEGACY_DONE_SIGNS_KEY);
    if (ids.length === 0) return;
    const map = readLearningMap(LEARNING_SIGNS_KEY);
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
    if (marked.length > 0) writeLearningMap(LEARNING_SIGNS_KEY, map);
    if (marked.length > 0 && syncEnabled()) {
      for (const id of marked) pushProgress("sign", id, map[id]!);
    }
    localStorage.removeItem(LEGACY_DONE_SIGNS_KEY);
  } catch {
    // ignore — migration retries on next load since the key stays put
  }
}

/** Hydrate sign progress from the server (server authoritative, local uploaded once when empty). */
export async function initSignSync(): Promise<void> {
  migrateDoneSigns();
  const local = readLearningMap(LEARNING_SIGNS_KEY);
  const hydrated = await hydrateProgress("sign", local);
  if (hydrated !== null) writeLearningMap(LEARNING_SIGNS_KEY, hydrated);
}

/** Remove all device-local sign progress and bookmarks (logout). */
export function clearSignLocalData(): void {
  try {
    localStorage.removeItem(LEARNING_SIGNS_KEY);
    localStorage.removeItem(FAV_SIGNS_KEY);
    localStorage.removeItem(LEGACY_DONE_SIGNS_KEY);
  } catch {
    // ignore
  }
}
