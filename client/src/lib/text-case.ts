/** Headings and subheadings arrive from the database in mixed casing. */

function stripBrackets(word: string): string {
  return word.replace(/[()[\]]/g, "");
}

const SHORT_WORDS = new Set([
  "of", "to", "in", "on", "at", "by", "a", "an", "or", "and", "for", "up", "down", "as", "is",
]);

function isAcronym(word: string): boolean {
  const bare = stripBrackets(word);
  if (!bare || bare.length > 3 || bare !== bare.toUpperCase() || !/[A-Z]/.test(bare)) return false;
  return !SHORT_WORDS.has(bare.toLowerCase());
}

function capitalize(word: string): string {
  const match = word.match(/^([([\]]*)(.*?)([)\]]*)$/);
  if (!match) return word;
  const [, open, inner, close] = match;
  if (!inner) return word;
  return `${open}${inner.charAt(0).toUpperCase()}${inner.slice(1).toLowerCase()}${close}`;
}

/** "GUIDANCE SIGNS" -> "Guidance Signs" */
export function titleCase(text: string): string {
  const trimmed = (text || "").trim();
  if (!trimmed) return "";
  return trimmed
    .split(/\s+/)
    .map((word) => (isAcronym(word) ? word : capitalize(word)))
    .join(" ");
}

/** "DIAGRAMMATIC SIGNS" -> "Diagrammatic signs", "Control Signs" -> "Control signs" */
export function sentenceCase(text: string): string {
  const trimmed = (text || "").trim();
  if (!trimmed) return "";
  return trimmed
    .split(/\s+/)
    .map((word, index) => (isAcronym(word) ? word : index === 0 ? capitalize(word) : word.toLowerCase()))
    .join(" ");
}
