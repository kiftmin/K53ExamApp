// Favorites + seen-ids + learner licence code for the Rules study module.
// Mirrors sign-storage.ts — plain JSON in localStorage, no backend changes.

const FAV_RULES_KEY = "k53_favorite_rules";
const SEEN_RULES_KEY = "k53_seen_rules";
const RULE_CODE_KEY = "k53_rules_licence_code";

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

export function getSeenRuleIds(): number[] {
  return readIds(SEEN_RULES_KEY);
}

export function markRuleSeen(id: number): void {
  const ids = readIds(SEEN_RULES_KEY);
  if (!ids.includes(id)) writeIds(SEEN_RULES_KEY, [...ids, id]);
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
