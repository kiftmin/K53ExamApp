// One shared status model for all three Study modules.
// Kept value names (`new` / `learning` / `review` / `mastered`) and the
// `RecallRating` type so progress-sync routes and shared/schema.ts
// validation keep working — the learner-facing words are only
// "Not yet" and "Got it". Legacy `review` rows read as known.

export type LearningStatus = "new" | "learning" | "review" | "mastered";
export type RecallRating = "again" | "hard" | "good" | "easy";

export type LearningRecord = {
  status: LearningStatus;
  correct: number;
  incorrect: number;
  lastRating: RecallRating;
  lastSeenAt: string; // ISO date
};

/** True for `mastered` and for legacy `review` rows. */
export function isKnown(status: LearningStatus | undefined | null): boolean {
  return status === "mastered" || status === "review";
}

/** Coerce a persisted count to a finite number (legacy rows may hold strings). */
export function toCount(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function isLearningStatus(value: unknown): value is LearningStatus {
  return value === "new" || value === "learning" || value === "review" || value === "mastered";
}

/**
 * Resolve the stored status after a rating.
 * "Not yet" (again/hard) always gives `learning` — a known card drops back.
 * "Got it" (good/easy) always gives `mastered`.
 */
export function nextStatus(record: LearningRecord | undefined, rating: RecallRating): LearningStatus {
  if (rating === "good" || rating === "easy") return "mastered";
  return "learning";
}

/**
 * Mark every known card in `ids` as not learned, in place.
 * Returns the ids that changed so the caller can sync just those.
 * Untried cards stay untried and already-unlearned cards are left alone,
 * so a bulk deselect is the same as tapping "Not yet" on each known card.
 */
export function deselectKnown(
  map: Record<number, LearningRecord>,
  ids: number[]
): number[] {
  const stamp = new Date().toISOString();
  const changed: number[] = [];
  for (const id of ids) {
    const prev = map[id];
    if (!isKnown(prev?.status)) continue;
    map[id] = {
      status: "learning",
      correct: toCount(prev?.correct),
      incorrect: toCount(prev?.incorrect) + 1,
      lastRating: "again",
      lastSeenAt: stamp,
    };
    changed.push(id);
  }
  return changed;
}

/** Count known vs total items from a learning map. */
export function countKnown(
  items: { id: number }[],
  learning: Record<number, LearningRecord>
): { known: number; total: number } {
  let known = 0;
  for (const item of items) if (isKnown(learning[item.id]?.status)) known++;
  return { known, total: items.length };
}
