import { describe, expect, it } from 'vitest';
import { didPlay, eventsSinceLastPlayed, finalisedEventsChronological } from '@/domain/history/eventHistory';
import { computeMemberStats } from '@/domain/history/memberStats';
import { makeFinalisedEvent, makeMember, makeSuspension } from '../fixtures';

describe('participation history', () => {
  const e1 = makeFinalisedEvent('e1', '2026-01-01', { a: 'core', b: 'substitute', c: 'substitute', d: 'notSelected' }, ['a', 'b']);
  const e2 = makeFinalisedEvent('e2', '2026-01-08', { a: 'rotation', c: 'core' }, ['c']);
  const open = { ...makeFinalisedEvent('e3', '2026-01-15', { a: 'core' }, ['a']), status: 'locked' as const };

  it('counts a substitute who entered as played, an unused substitute as not played', () => {
    expect(didPlay(e1, 'b')).toBe(true);
    expect(didPlay(e1, 'c')).toBe(false);
    expect(didPlay(e1, 'd')).toBe(false);
  });

  it('ignores events that are not finalised and orders chronologically', () => {
    expect(finalisedEventsChronological([e2, open, e1]).map((e) => e.id)).toEqual(['e1', 'e2']);
  });

  it('computes events since last played', () => {
    const chronological = [e1, e2];
    expect(eventsSinceLastPlayed(chronological, 'c')).toBe(0);
    expect(eventsSinceLastPlayed(chronological, 'a')).toBe(1);
    expect(eventsSinceLastPlayed(chronological, 'd')).toBeNull();
  });

  it('computes participation rate = played / registered', () => {
    const stats = computeMemberStats(makeMember({ id: 'a' }), [e1, e2, open], [makeSuspension({ id: 's', memberId: 'a', remainingEvents: 1 })]);
    expect(stats).toEqual({
      memberId: 'a',
      eventsRegistered: 2,
      timesPlayed: 1,
      participationRate: 0.5,
      eventsSinceLastPlayed: 1,
      suspensionRemaining: 1,
    });
    expect(computeMemberStats(makeMember({ id: 'zz' }), [e1], []).participationRate).toBeNull();
  });
});
