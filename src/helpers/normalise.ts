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
