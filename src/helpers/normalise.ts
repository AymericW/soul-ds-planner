/** Letters that NFKD does not split into base letter + accent. */
const NON_DECOMPOSING: Record<string, string> = { ø: 'o', æ: 'ae', œ: 'oe', ß: 'ss', đ: 'd', ł: 'l', ð: 'd' };

/**
 * Name normalisation used for matching (roster import, OCR, aliases):
 * lower-case, accents removed, only letters and digits kept.
 * "  Dräg0n_Slayer ★ " -> "drag0nslayer"
 */
export function normaliseName(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[øæœßđłð]/g, (ch) => NON_DECOMPOSING[ch] ?? ch)
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

/** Trims and collapses inner whitespace for display names. */
export function cleanDisplayName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

/** Normalised header key: "Activity Rating (1-5)" -> "activityrating15". */
export function normaliseHeader(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, '');
}
