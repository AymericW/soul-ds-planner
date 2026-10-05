import { describe, expect, it } from 'vitest';
import { rankByScore } from '@/domain/scoring/coreRanking';
import { computeRelativeScores, normaliseActivity, normaliseWeights, relativePower } from '@/domain/scoring/relativeScore';
import { makeMember } from '../fixtures';

describe('relative scoring', () => {
  it('normalises power against the strongest applicant of the pool', () => {
    expect(relativePower(200, 200)).toBe(1);
    expect(relativePower(100, 200)).toBe(0.5);
    expect(relativePower(0, 200)).toBe(0);
    expect(relativePower(100, 0)).toBe(0);
  });

  it('maps activity 1..5 to 0..1 (clamped)', () => {
    expect(normaliseActivity(1)).toBe(0);
    expect(normaliseActivity(3)).toBe(0.5);
    expect(normaliseActivity(5)).toBe(1);
    expect(normaliseActivity(9)).toBe(1);
  });

  it('rescales weights to sum to 1 and falls back to defaults when both are 0', () => {
    expect(normaliseWeights({ power: 7, activity: 3 })).toEqual({ power: 0.7, activity: 0.3 });
    expect(normaliseWeights({ power: 0, activity: 0 })).toEqual({ power: 0.7, activity: 0.3 });
  });

  it('computes score = 0.7 * power/max + 0.3 * (activity-1)/4 by default', () => {
    const pool = [
      makeMember({ id: 'a', power: 200_000_000, activity: 1 }),
      makeMember({ id: 'b', power: 150_000_000, activity: 5 }),
    ];
    const scores = computeRelativeScores(pool, { power: 0.7, activity: 0.3 });
    expect(scores.get('a')!.score).toBeCloseTo(0.7, 6);
    expect(scores.get('b')!.score).toBeCloseTo(0.7 * 0.75 + 0.3, 6); // 0.825
  });

  it('is relative: the same member scores differently in a different pool', () => {
    const mid = makeMember({ id: 'mid', power: 100_000_000, activity: 3 });
    const weak = computeRelativeScores([mid, makeMember({ id: 'w', power: 50_000_000 })], { power: 1, activity: 0 });
    const strong = computeRelativeScores([mid, makeMember({ id: 's', power: 400_000_000 })], { power: 1, activity: 0 });
    expect(weak.get('mid')!.score).toBe(1);
    expect(strong.get('mid')!.score).toBe(0.25);
  });

  it('honours configurable weights (100% activity)', () => {
    const pool = [makeMember({ id: 'a', power: 300, activity: 2 }), makeMember({ id: 'b', power: 100, activity: 4 })];
    const scores = computeRelativeScores(pool, { power: 0, activity: 1 });
    expect(scores.get('b')!.score).toBeGreaterThan(scores.get('a')!.score);
  });
});

describe('rankByScore (close scores: higher activity wins)', () => {
  const entry = (id: string, score: number, activity: number, power = 100) => ({
    member: makeMember({ id, activity, power }),
    score: { memberId: id, powerRatio: 0, activityNorm: 0, score },
  });

  it('orders by score when scores are clearly different', () => {
    const ranked = rankByScore([entry('a', 0.5, 5), entry('b', 0.9, 1), entry('c', 0.7, 3)], 0.02);
    expect(ranked.map((e) => e.member.id)).toEqual(['b', 'c', 'a']);
  });

  it('lets higher activity win within epsilon', () => {
    const ranked = rankByScore([entry('a', 0.8, 2), entry('b', 0.79, 4)], 0.02);
    expect(ranked.map((e) => e.member.id)).toEqual(['b', 'a']);
  });

  it('does not reorder outside epsilon or with epsilon 0', () => {
    expect(rankByScore([entry('a', 0.8, 2), entry('b', 0.75, 4)], 0.02).map((e) => e.member.id)).toEqual(['a', 'b']);
    expect(rankByScore([entry('a', 0.8, 2), entry('b', 0.79, 4)], 0).map((e) => e.member.id)).toEqual(['a', 'b']);
  });

  it('breaks exact ties by activity, then power, then name', () => {
    const ranked = rankByScore([entry('c', 0.5, 3, 100), entry('b', 0.5, 3, 200), entry('a', 0.5, 4, 50)], 0);
    expect(ranked.map((e) => e.member.id)).toEqual(['a', 'b', 'c']);
  });

  it('is deterministic regardless of input order', () => {
    const list = [entry('a', 0.81, 2), entry('b', 0.8, 3), entry('c', 0.79, 5), entry('d', 0.6, 5)];
    const first = rankByScore(list, 0.02).map((e) => e.member.id);
    const second = rankByScore([...list].reverse(), 0.02).map((e) => e.member.id);
    expect(first).toEqual(second);
    expect(first).toEqual(['c', 'b', 'a', 'd']);
  });
});
