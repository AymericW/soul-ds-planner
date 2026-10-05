import { describe, expect, it } from 'vitest';
import { computeOcrScale, isDarkBackground, preprocessForOcr, toGrayscale } from '@/helpers/imagePreprocessing';

describe('image preprocessing for OCR', () => {
  it('upscales small screenshots but never more than 3x', () => {
    expect(computeOcrScale(400)).toBe(3);
    expect(computeOcrScale(800)).toBe(2);
    expect(computeOcrScale(2400)).toBe(1);
  });

  it('inverts dark screenshots so text becomes dark on light', () => {
    // 9 dark pixels + 1 bright "text" pixel
    const px = (v: number) => [v, v, v, 255];
    const rgba = new Uint8ClampedArray([...Array(9).fill(0).flatMap(() => px(20)), ...px(230)]);
    expect(isDarkBackground(toGrayscale(rgba))).toBe(true);
    const out = preprocessForOcr(rgba);
    expect(out[0]).toBe(255); // background -> white
    expect(out[36]).toBe(0); // text -> black
  });
});
