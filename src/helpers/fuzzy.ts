/** Classic Levenshtein edit distance (insert/delete/substitute = 1). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length]!;
}

/** Similarity in [0, 1]: 1 = identical, based on edit distance relative to the longer string. */
export function similarity(a: string, b: string): number {
  if (!a.length && !b.length) return 1;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

/**
 * Common OCR confusions folded to one canonical character so "S0UL" ~ "SOUL", "l1" ~ "ll".
 * Applied on already-normalised (lower-case alphanumeric) strings.
 */
const OCR_FOLD: Record<string, string> = { '0': 'o', '1': 'l', i: 'l', '5': 's', '8': 'b', '6': 'g', '2': 'z', '7': 't' };

export function foldOcrConfusions(normalised: string): string {
  let out = '';
  for (const ch of normalised) out += OCR_FOLD[ch] ?? ch;
  return out;
}
