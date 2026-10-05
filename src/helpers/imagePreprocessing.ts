/**
 * Pure pixel helpers used before OCR (operate on RGBA arrays, no DOM).
 * Game screenshots are usually light text on dark backgrounds; Tesseract reads
 * dark text on a light background best, so we grey-scale, invert when the
 * background is dark and stretch the contrast.
 */

/** Target width (px) for OCR: small phone screenshots are upscaled, big ones left alone. */
export const OCR_TARGET_WIDTH = 1600;
export const OCR_MAX_SCALE = 3;

export function computeOcrScale(width: number): number {
  if (!(width > 0)) return 1;
  return Math.min(OCR_MAX_SCALE, Math.max(1, OCR_TARGET_WIDTH / width));
}

/** Luminance (0-255) for each pixel. */
export function toGrayscale(rgba: Uint8ClampedArray): Uint8ClampedArray {
  const gray = new Uint8ClampedArray(rgba.length / 4);
  for (let i = 0, p = 0; i < rgba.length; i += 4, p++) {
    gray[p] = Math.round(0.299 * rgba[i]! + 0.587 * rgba[i + 1]! + 0.114 * rgba[i + 2]!);
  }
  return gray;
}

export function meanLuminance(gray: Uint8ClampedArray): number {
  if (gray.length === 0) return 255;
  let sum = 0;
  for (const v of gray) sum += v;
  return sum / gray.length;
}

export function isDarkBackground(gray: Uint8ClampedArray): boolean {
  return meanLuminance(gray) < 110;
}

/** Linear stretch between the 2nd and 98th percentile (ignores outliers). */
export function contrastBounds(gray: Uint8ClampedArray): { low: number; high: number } {
  const histogram = new Array<number>(256).fill(0);
  for (const v of gray) histogram[v]!++;
  const cutoff = gray.length * 0.02;
  let low = 0;
  let acc = 0;
  while (low < 255 && acc + histogram[low]! <= cutoff) acc += histogram[low++]!;
  let high = 255;
  acc = 0;
  while (high > low && acc + histogram[high]! <= cutoff) acc += histogram[high--]!;
  return { low, high: Math.max(high, low + 1) };
}

/** Writes the processed grey value back into an RGBA buffer (in place) and returns it. */
export function preprocessForOcr(rgba: Uint8ClampedArray): Uint8ClampedArray {
  const gray = toGrayscale(rgba);
  const invert = isDarkBackground(gray);
  const { low, high } = contrastBounds(gray);
  const range = high - low;
  for (let i = 0, p = 0; i < rgba.length; i += 4, p++) {
    let v = ((gray[p]! - low) / range) * 255;
    if (invert) v = 255 - v;
    const c = Math.max(0, Math.min(255, Math.round(v)));
    rgba[i] = c;
    rgba[i + 1] = c;
    rgba[i + 2] = c;
    rgba[i + 3] = 255;
  }
  return rgba;
}
