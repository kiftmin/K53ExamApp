/**
 * Flashcard pages accept `?ids=1,2,3` from the results screen. The deck is
 * exactly those cards, in that order. Returns null when the page is not in
 * ids mode, or an array (possibly empty) when it is.
 */
export function getPracticeIdsFromUrl(): number[] | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("ids");
  if (raw === null) return null;

  const ids: number[] = [];
  const seen = new Set<number>();
  for (const part of raw.split(",")) {
    const id = Number(part.trim());
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

/** True when the deck was opened from the completed-test report card. */
export function isFromResults(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("from") === "results";
}
