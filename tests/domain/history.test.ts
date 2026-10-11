import { describe, expect, it } from 'vitest';
import { didPlay, finalisedEventsChronological } from '@/domain/history/eventHistory';
import { computeMemberStats } from '@/domain/history/memberStats';
import { finalisedWeeks, playedLastWeek, weeksBefore, weeksSinceLastPlayed } from '@/domain/history/weekHistory';
import { makeFinalisedEvent, makeMember, makeSuspension } from '../fixtures';

describe('participation history', () => {
  const e1 = makeFinalisedEvent('e1', '2026-01-02', { a: 'core', b: 'substitute', c: 'substitute', d: 'notSelected' }, ['a', 'b']);
  const e2 = makeFinalisedEvent('e2', '2026-01-09', { a: 'rotation', c: 'core' }, ['c']);
  const open = { ...makeFinalisedEvent('e3', '2026-01-16', { a: 'core' }, ['a']), status: 'locked' as const };

  it('counts a substitute who entered as played, an unused substitute as not played', () => {
    expect(didPlay(e1, 'b')).toBe(true);
    expect(didPlay(e1, 'c')).toBe(false);
    expect(didPlay(e1, 'd')).toBe(false);
  });

  it('ignores events that are not finalised and orders chronologically', () => {
    expect(finalisedEventsChronological([e2, open, e1]).map((e) => e.id)).toEqual(['e1', 'e2']);
  });

  it('computes weeks since last played', () => {
    const weeks = finalisedWeeks([e1, e2]);
    expect(weeksSinceLastPlayed(weeks, 'c')).toBe(0);
    expect(weeksSinceLastPlayed(weeks, 'a')).toBe(1);
    expect(weeksSinceLastPlayed(weeks, 'd')).toBeNull();
  });

  it('computes participation rate = weeks played / weeks registered', () => {
    const stats = computeMemberStats(makeMember({ id: 'a' }), [e1, e2, open], [makeSuspension({ id: 's', memberId: 'a', remainingEvents: 1 })]);
    expect(stats).toEqual({
      memberId: 'a',
      weeksRegistered: 2,
      weeksPlayed: 1,
      participationRate: 0.5,
      weeksSinceLastPlayed: 1,
      suspensionRemaining: 1,
    });
    expect(computeMemberStats(makeMember({ id: 'zz' }), [e1], []).participationRate).toBeNull();
  });
});

describe('history over Team A and Team B combined (counted in weeks)', () => {
  // Week 1 (Fri 2 Jan): x plays B, registered for A too but only a substitute there (not used).
  const w1B = makeFinalisedEvent('2026-01-02-B', '2026-01-02', { x: 'core', y: 'substitute' }, ['x'], [], 'B');
  const w1A = makeFinalisedEvent('2026-01-02-A', '2026-01-02', { x: 'substitute', y: 'core' }, ['y'], [], 'A');
  // Week 2 (Fri 9 Jan): only Team A was played; x not selected, y plays.
  const w2A = makeFinalisedEvent('2026-01-09-A', '2026-01-09', { x: 'notSelected', y: 'core' }, ['y'], [], 'A');

  it('groups the events of one Friday into one week, oldest first', () => {
    const weeks = finalisedWeeks([w2A, w1A, w1B]);
    expect(weeks.map((w) => [w.key, w.events.map((e) => e.id)])).toEqual([
      ['2025-12-29', ['2026-01-02-B', '2026-01-02-A']],
      ['2026-01-05', ['2026-01-09-A']],
    ]);
    expect(weeksBefore(weeks, '2026-01-05').map((w) => w.key)).toEqual(['2025-12-29']);
  });

  it('registered for both and played one = one played week (not a no-show)', () => {
    const stats = computeMemberStats(makeMember({ id: 'x' }), [w1B, w1A], []);
    expect(stats).toMatchObject({ weeksRegistered: 1, weeksPlayed: 1, participationRate: 1, weeksSinceLastPlayed: 0 });
  });

  it('counts weeks since last played across both events', () => {
    const weeks = finalisedWeeks([w1B, w1A, w2A]);
    expect(weeksSinceLastPlayed(weeks, 'x')).toBe(1);
    expect(playedLastWeek(weeks, 'x')).toBe(false);
    expect(weeksSinceLastPlayed(weeks, 'y')).toBe(0);
    expect(computeMemberStats(makeMember({ id: 'x' }), [w1B, w1A, w2A], [])).toMatchObject({ weeksRegistered: 2, weeksPlayed: 1, participationRate: 0.5 });
  });

  it('never counts a week twice even if a player (by mistake) played both events', () => {
    const a = makeFinalisedEvent('A', '2026-01-02', { z: 'core' }, ['z'], [], 'A');
    const b = makeFinalisedEvent('B', '2026-01-02', { z: 'core' }, ['z'], [], 'B');
    expect(computeMemberStats(makeMember({ id: 'z' }), [a, b], [])).toMatchObject({ weeksRegistered: 1, weeksPlayed: 1 });
  });
});
