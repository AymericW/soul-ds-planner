import { describe, expect, it } from 'vitest';
import { formatEventsAgo, formatPercent, formatPower, parsePower } from '@/helpers/format';

describe('parsePower', () => {
  const cases: Array<[unknown, number | undefined]> = [
    ['152.3M', 152_300_000],
    ['152,3 M', 152_300_000],
    ['1.2B', 1_200_000_000],
    ['950k', 950_000],
    ['152 300 000', 152_300_000],
    ['152,300,000', 152_300_000],
    ['152.300.000', 152_300_000],
    ['152.3', 152_300_000],
    [87, 87_000_000],
    [152300000, 152_300_000],
    ['abc', undefined],
    ['', undefined],
    [-5, undefined],
  ];
  for (const [input, expected] of cases) {
    it(`parses ${JSON.stringify(input)}`, () => {
      expect(parsePower(input)).toBe(expected);
    });
  }
});

describe('formatting', () => {
  it('formats power compactly', () => {
    expect(formatPower(152_340_000)).toBe('152.3M');
    expect(formatPower(1_234_000_000)).toBe('1.23B');
    expect(formatPower(950_000)).toBe('950K');
  });

  it('formats percentages and "events ago"', () => {
    expect(formatPercent(0.666)).toBe('67%');
    expect(formatPercent(null)).toBe('–');
    expect(formatEventsAgo(null)).toBe('never');
    expect(formatEventsAgo(0)).toBe('last event');
    expect(formatEventsAgo(3)).toBe('3 events ago');
  });
});
