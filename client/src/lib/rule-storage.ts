// Favorites + seen-ids + learner licence code for the Rules study module.
// Mirrors sign-storage.ts — plain JSON in localStorage, no backend changes.

const FAV_RULES_KEY = "k53_favorite_rules";
const RULE_CODE_KEY = "k53_rules_licence_code";
const LEARNING_RULES_KEY = "k53_rule_learning";
const DONE_RULES_KEY = "k53_done_rules";

// === Learning records (Phase 2 mastery model) ===

export type LearningStatus = "new" | "learning" | "review" | "mastered";
export type RecallRating = "again" | "hard" | "good" | "easy";

export type LearningRecord = {
  status: LearningStatus;
  correct: number;
  incorrect: number;
  lastRating: RecallRating;
  lastSeenAt: string;
};

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

function writeLearningMap(key: string, map: Record<number, LearningRecord>): void {
  try {
    localStorage.setItem(key, JSON.stringify(map));
  } catch {
    // ignore
  }
}

function nextStatus(record: LearningRecord | undefined, rating: RecallRating): LearningStatus {
  const current = record?.status ?? "new";
  if (current === "new") return "learning";
  switch (rating) {
    case "again":
      return "learning";
    case "hard":
      return "learning";
    case "good":
      return current === "mastered" ? "mastered" : "review";
    case "easy":
      return current === "review" || current === "mastered" ? "mastered" : "review";
  }
}

export function rateRule(id: number, rating: RecallRating): LearningRecord {
  const map = readLearningMap(LEARNING_RULES_KEY);
  const prev = map[id];
  const record: LearningRecord = {
    status: nextStatus(prev, rating),
    correct: (prev?.correct ?? 0) + (rating === "good" || rating === "easy" ? 1 : 0),
    incorrect: (prev?.incorrect ?? 0) + (rating === "again" || rating === "hard" ? 1 : 0),
    lastRating: rating,
    lastSeenAt: new Date().toISOString(),
  };
  map[id] = record;
  writeLearningMap(LEARNING_RULES_KEY, map);
  return record;
}

export function getRuleLearning(id: number): LearningRecord | undefined {
  return readLearningMap(LEARNING_RULES_KEY)[id];
}

export function getAllRuleLearning(): Record<number, LearningRecord> {
  return readLearningMap(LEARNING_RULES_KEY);
}

export function getSeenRuleIds(): number[] {
  const map = readLearningMap(LEARNING_RULES_KEY);
  return Object.keys(map).map(Number).filter((id) => map[id]?.status && map[id].status !== "new");
}

export function markRuleSeen(id: number): void {
  const map = readLearningMap(LEARNING_RULES_KEY);
  if (!map[id]) {
    map[id] = { status: "learning", correct: 0, incorrect: 0, lastRating: "good", lastSeenAt: new Date().toISOString() };
    writeLearningMap(LEARNING_RULES_KEY, map);
  } else if (map[id].status === "new") {
    map[id] = { ...map[id], status: "learning", lastSeenAt: new Date().toISOString() };
    writeLearningMap(LEARNING_RULES_KEY, map);
  }
}

export function clearSeenRules(): void {
  try {
    localStorage.removeItem(LEARNING_RULES_KEY);
  } catch {
    // ignore
  }
}

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

export function getFavoriteRuleIds(): number[] {
  return readIds(FAV_RULES_KEY);
}

export function getDoneRuleIds(): number[] {
  return readIds(DONE_RULES_KEY);
}

/** Remove the given ids from a bookmark list. */
export function removeRuleBookmarks(kind: "done" | "favorite" | "both", ids: number[]): void {
  const drop = new Set(ids);
  if (kind === "favorite" || kind === "both") {
    writeIds(FAV_RULES_KEY, readIds(FAV_RULES_KEY).filter((id) => !drop.has(id)));
  }
  if (kind === "done" || kind === "both") {
    writeIds(DONE_RULES_KEY, readIds(DONE_RULES_KEY).filter((id) => !drop.has(id)));
  }
}

/** Toggles done. Returns true if the rule is now marked done. */
export function toggleDoneRule(id: number): boolean {
  const ids = readIds(DONE_RULES_KEY);
  const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
  writeIds(DONE_RULES_KEY, next);
  return next.includes(id);
}

export function isFavoriteRule(id: number): boolean {
  return readIds(FAV_RULES_KEY).includes(id);
}

/** Toggles favorite. Returns true if the rule is now a favorite. */
export function toggleFavoriteRule(id: number): boolean {
  const ids = readIds(FAV_RULES_KEY);
  const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
  writeIds(FAV_RULES_KEY, next);
  return next.includes(id);
}

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
