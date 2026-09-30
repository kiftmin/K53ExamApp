// Favorites + seen-ids for the Study modules.
// Same localStorage pattern quiz-context.tsx uses for quiz state —
// plain JSON arrays of ids, no backend changes needed.

const FAV_SIGNS_KEY = "k53_favorite_signs";
const SEEN_SIGNS_KEY = "k53_seen_signs";

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

export function getSeenSignIds(): number[] {
  return readIds(SEEN_SIGNS_KEY);
}

export function markSignSeen(id: number): void {
  const ids = readIds(SEEN_SIGNS_KEY);
  if (!ids.includes(id)) writeIds(SEEN_SIGNS_KEY, [...ids, id]);
}

export function clearSeenSigns(): void {
  try {
    localStorage.removeItem(SEEN_SIGNS_KEY);
  } catch {
    // ignore
  }
}
