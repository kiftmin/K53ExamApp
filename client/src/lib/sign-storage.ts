// Favorites + learning records for the Study modules.
// Same localStorage pattern quiz-context.tsx uses for quiz state —
// plain JSON, no backend changes needed.

const FAV_SIGNS_KEY = "k53_favorite_signs";
const LEARNING_SIGNS_KEY = "k53_sign_learning";

// === Learning records (Phase 2 mastery model) ===

export type LearningStatus = "new" | "learning" | "review" | "mastered";
export type RecallRating = "again" | "hard" | "good" | "easy";

export type LearningRecord = {
  status: LearningStatus;
  correct: number;
  incorrect: number;
  lastRating: RecallRating;
  lastSeenAt: string; // ISO date
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
    // storage full / private mode — study still works, just not persisted
  }
}

function nextStatus(record: LearningRecord | undefined, rating: RecallRating): LearningStatus {
  const current = record?.status ?? "new";
  if (current === "new") return "learning"; // first rating of any kind
  switch (rating) {
    case "again":
      return "learning"; // any wrong answer costs standing
    case "hard":
      return "learning";
    case "good":
      // learning/review → review settles; mastered holds mastery
      return current === "mastered" ? "mastered" : "review";
    case "easy":
      return current === "review" || current === "mastered" ? "mastered" : "review";
  }
}

export function rateSign(id: number, rating: RecallRating): LearningRecord {
  const map = readLearningMap(LEARNING_SIGNS_KEY);
  const prev = map[id];
  const record: LearningRecord = {
    status: nextStatus(prev, rating),
    correct: (prev?.correct ?? 0) + (rating === "good" || rating === "easy" ? 1 : 0),
    incorrect: (prev?.incorrect ?? 0) + (rating === "again" || rating === "hard" ? 1 : 0),
    lastRating: rating,
    lastSeenAt: new Date().toISOString(),
  };
  map[id] = record;
  writeLearningMap(LEARNING_SIGNS_KEY, map);
  return record;
}

export function getSignLearning(id: number): LearningRecord | undefined {
  return readLearningMap(LEARNING_SIGNS_KEY)[id];
}

export function getAllSignLearning(): Record<number, LearningRecord> {
  return readLearningMap(LEARNING_SIGNS_KEY);
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

export function getFavoriteSignIds(): number[] {
  return readIds(FAV_SIGNS_KEY);
}

export function isFavoriteSign(id: number): boolean {
  return readIds(FAV_SIGNS_KEY).includes(id);
}

/** Toggles favorite. Returns true if the sign is now a favorite. */
export function toggleFavoriteSign(id: number): boolean {
  const ids = readIds(FAV_SIGNS_KEY);
  const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
  writeIds(FAV_SIGNS_KEY, next);
  return next.includes(id);
}

// === Back-compat wrappers over the learning map ===
// "seen" is now derived: an item is no longer unseen once it has a
// learning record (status moved off "new").

export function getSeenSignIds(): number[] {
  const map = readLearningMap(LEARNING_SIGNS_KEY);
  return Object.keys(map)
    .map(Number)
    .filter((id) => map[id]?.status && map[id].status !== "new");
}

export function markSignSeen(id: number): void {
  const map = readLearningMap(LEARNING_SIGNS_KEY);
  if (!map[id]) {
    map[id] = {
      status: "learning",
      correct: 0,
      incorrect: 0,
      lastRating: "good",
      lastSeenAt: new Date().toISOString(),
    };
    writeLearningMap(LEARNING_SIGNS_KEY, map);
  } else if (map[id].status === "new") {
    map[id] = { ...map[id], status: "learning", lastSeenAt: new Date().toISOString() };
    writeLearningMap(LEARNING_SIGNS_KEY, map);
  }
}

export function clearSeenSigns(): void {
  try {
    localStorage.removeItem(LEARNING_SIGNS_KEY);
  } catch {
    // ignore
  }
}
