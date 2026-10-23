// Helpers for temporary road-sign codes (T-prefixed, e.g. TW112, TR321, TGA4).
// A T-code is the temporary version of the same sign, not another variant.

export const SHOW_TEMPORARY_SIGNS = true;

const TEMPORARY_CODE_RE = /^T[A-Z]+\d/;

export function isTemporaryCode(code: string): boolean {
  return TEMPORARY_CODE_RE.test(code);
}

export function splitCodes(codes: string[]): { permanent: string[]; temporary: string[] } {
  const permanent: string[] = [];
  const temporary: string[] = [];
  for (const code of codes) {
    if (isTemporaryCode(code)) temporary.push(code);
    else permanent.push(code);
  }
  return { permanent, temporary };
}

export type SignImage = { code: string; image_url: string };

/** Permanent-code images first, temporary-code images last; order preserved within groups. */
export function orderImages<T extends { code: string }>(images: T[]): T[] {
  return [...images.filter((img) => !isTemporaryCode(img.code)), ...images.filter((img) => isTemporaryCode(img.code))];
}

export function temporaryLabel(codes: string[]): string {
  return codes.length === 1
    ? `Temporary sign code: ${codes[0]}`
    : `Temporary sign codes: ${codes.join(", ")}`;
}

/** True when the record has only temporary codes (its own card, but all-T). */
export function isTemporaryOnlyRecord(codes: string[]): boolean {
  return codes.length > 0 && codes.every(isTemporaryCode);
}

/** Drop temporary-only records from learner-facing lists and counts when temporary signs are hidden. */
export function visibleSigns<T extends { codes: string[] }>(items: T[]): T[] {
  if (SHOW_TEMPORARY_SIGNS) return items;
  return items.filter((item) => !isTemporaryOnlyRecord(item.codes));
}
