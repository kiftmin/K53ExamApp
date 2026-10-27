// Saved marks + learner licence code for the Rules study module.
// Mirrors sign-storage.ts — plain JSON in localStorage, no backend changes.
// Progress is server-synced for W/M/X codes via progress-sync.ts.

import { syncEnabled, pushProgress, hydrateProgress, recordOwnerIfMissing } from "./progress-sync";
import { isKnown, nextStatus, toCount, deselectKnown, type LearningStatus, type RecallRating, type LearningRecord } from "./learning-status";

export type { LearningStatus, RecallRating, LearningRecord };
export { isKnown };

const FAV_RULES_KEY = "k53_favorite_rules";
const RULE_CODE_KEY = "k53_rules_licence_code";
const LEARNING_RULES_KEY = "k53_rule_learning";
const LEGACY_DONE_RULES_KEY = "k53_done_rules";

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
    // ignore
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

export function rateRule(id: number, rating: RecallRating): LearningRecord {
  recordOwnerIfMissing();
  const map = readLearningMap(LEARNING_RULES_KEY);
  const record = rateLearningRecord(map, id, rating === "again" || rating === "hard");
  writeLearningMap(LEARNING_RULES_KEY, map);

  if (syncEnabled()) {
    pushProgress("rule", id, record);
  }

  return record;
}

/** "I know this" tick: mark as known, or drop back to to-practise. */
export function setRuleKnown(id: number, known: boolean): LearningRecord {
  return rateRule(id, known ? "good" : "again");
}

export function getRuleLearning(id: number): LearningRecord | undefined {
  return readLearningMap(LEARNING_RULES_KEY)[id];
}

export function getAllRuleLearning(): Record<number, LearningRecord> {
  return readLearningMap(LEARNING_RULES_KEY);
}

/** Remove the learning records for these ids (Reset section). */
export function resetRuleProgress(ids: number[]): void {
  recordOwnerIfMissing();
  const drop = new Set(ids);
  const map = readLearningMap(LEARNING_RULES_KEY);
  const removed: number[] = [];
  for (const key of Object.keys(map).map(Number)) {
    if (drop.has(key)) {
      delete map[key];
      removed.push(key);
    }
  }
  writeLearningMap(LEARNING_RULES_KEY, map);

  if (syncEnabled()) {
    for (const id of removed) {
      pushProgress("rule", id, {
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
export function deselectRules(ids: number[]): void {
  recordOwnerIfMissing();
  const map = readLearningMap(LEARNING_RULES_KEY);
  const changed = deselectKnown(map, ids);
  if (changed.length === 0) return;
  writeLearningMap(LEARNING_RULES_KEY, map);

  if (syncEnabled()) {
    for (const id of changed) {
      pushProgress("rule", id, map[id]!);
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
    // ignore
  }
}

export function getFavoriteRuleIds(): number[] {
  return readIds(FAV_RULES_KEY);
}

export function isFavoriteRule(id: number): boolean {
  return readIds(FAV_RULES_KEY).includes(id);
}

/** Remove the given ids from the saved list. */
export function removeFavoriteRules(ids: number[]): void {
  const drop = new Set(ids);
  writeIds(FAV_RULES_KEY, readIds(FAV_RULES_KEY).filter((id) => !drop.has(id)));
}

/** Toggles saved. Returns true if the rule is now saved. */
export function toggleFavoriteRule(id: number): boolean {
  const ids = readIds(FAV_RULES_KEY);
  const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
  writeIds(FAV_RULES_KEY, next);
  return next.includes(id);
}

// === One-time migration: fold the old done tick-lists into known status ===

function migrateDoneRules(): void {
  try {
    const ids = readIds(LEGACY_DONE_RULES_KEY);
    if (ids.length === 0) return;
    const map = readLearningMap(LEARNING_RULES_KEY);
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
    if (marked.length > 0) writeLearningMap(LEARNING_RULES_KEY, map);
    if (marked.length > 0 && syncEnabled()) {
      for (const id of marked) pushProgress("rule", id, map[id]!);
    }
    localStorage.removeItem(LEGACY_DONE_RULES_KEY);
  } catch {
    // ignore — migration retries on next load since the key stays put
  }
}

/** Hydrate rule progress from the server (server authoritative, local uploaded once when empty). */
export async function initRuleSync(): Promise<void> {
  migrateDoneRules();
  const local = readLearningMap(LEARNING_RULES_KEY);
  const hydrated = await hydrateProgress("rule", local);
  if (hydrated !== null) writeLearningMap(LEARNING_RULES_KEY, hydrated);
}

/** Remove all device-local rule progress and bookmarks (logout). */
export function clearRuleLocalData(): void {
  try {
    localStorage.removeItem(LEARNING_RULES_KEY);
    localStorage.removeItem(FAV_RULES_KEY);
    localStorage.removeItem(LEGACY_DONE_RULES_KEY);
  } catch {
    // ignore
  }
}

// === Learner licence code (same value the Rules gate persists) ===

export function getRulesLicenceCode(): number | null {
  try {
    const raw = localStorage.getItem(RULE_CODE_KEY);
    if (raw === "1" || raw === "2" || raw === "3") return parseInt(raw, 10);
    return null;
  } catch {
    return null;
  }
}

export function setRulesLicenceCode(code: number): void {
  try {
    localStorage.setItem(RULE_CODE_KEY, String(code));
  } catch {
    // ignore
  }
}

export function clearRulesLicenceCode(): void {
  try {
    localStorage.removeItem(RULE_CODE_KEY);
  } catch {
    // ignore
  }
}
