import { describe, expect, it } from 'vitest';
import { finaliseEvent } from '@/domain/penalties/finaliseEvent';
import { isPenalised, membersToPenalise, needsNotificationAnswer } from '@/domain/penalties/penaltyRules';
import { countDownSuspensions, isSuspended, liftSuspensions, remainingSuspension } from '@/domain/penalties/suspensions';
import { runSelection } from '@/domain/selection/runSelection';
import type { Attendance } from '@/models/Attendance';
import type { Suspension } from '@/models/Suspension';
import type { WeekEvent } from '@/models/WeekEvent';
import { makeMember, makeSettings, makeSuspension } from '../fixtures';

function lockedEvent(id: string, date: string, lineup: Record<string, 'core' | 'rotation' | 'substitute' | 'notSelected'>): WeekEvent {
  return {
    id,
    label: `DS ${date}`,
    date,
    status: 'locked',
    registrations: Object.keys(lineup).map((memberId) => ({ memberId, source: 'manual' })),
    assignments: Object.entries(lineup).map(([memberId, slot], order) => ({ memberId, slot, order, reason: '' })),
    attendance: [],
    suspensionIdsIssued: [],
    createdAt: `${date}T08:00:00.000Z`,
    updatedAt: `${date}T08:00:00.000Z`,
  };
}

const att = (memberId: string, attended: boolean, notified = false): Attendance => ({ memberId, attended, notified });
let seq = 0;
const newId = () => `susp-${++seq}`;

describe('penalty rule', () => {
  it('suspends a starter (core or rotation) who did not attend and did not notify', () => {
    expect(isPenalised('core', att('x', false))).toBe(true);
    expect(isPenalised('rotation', att('x', false))).toBe(true);
    expect(isPenalised('core', undefined)).toBe(true);
  });

  it('never penalises a notified absence (even a late notification)', () => {
    expect(isPenalised('core', att('x', false, true))).toBe(false);
    expect(isPenalised('rotation', att('x', false, true))).toBe(false);
  });

  it('never penalises substitutes, even called and absent, or not-selected players', () => {
    expect(isPenalised('substitute', att('x', false))).toBe(false);
    expect(isPenalised('substitute', undefined)).toBe(false);
    expect(isPenalised('notSelected', undefined)).toBe(false);
  });

  it('only asks the notification question for absent starters', () => {
    expect(needsNotificationAnswer('core', att('x', false))).toBe(true);
    expect(needsNotificationAnswer('core', att('x', true))).toBe(false);
    expect(needsNotificationAnswer('substitute', att('x', false))).toBe(false);
  });

  it('lists who would be penalised', () => {
    const event = lockedEvent('e', '2026-02-01', { a: 'core', b: 'core', c: 'rotation', d: 'substitute', r4: 'rotation' });
    expect(membersToPenalise(event, [att('a', true), att('b', false, true), att('c', false), att('d', false)])).toEqual(['c', 'r4']);
  });
});

describe('finaliseEvent', () => {
  const settings = makeSettings({ suspensionEvents: 2 });

  it('issues suspensions for no-shows without notice and records attendance for the lineup only', () => {
    const event = lockedEvent('e1', '2026-02-01', { a: 'core', b: 'rotation', c: 'substitute', d: 'substitute', x: 'notSelected' });
    const result = finaliseEvent({
      event,
      attendance: [att('a', true), att('b', false), att('c', true), att('d', false)],
      suspensions: [],
      settings,
      nowIso: '2026-02-01T21:00:00.000Z',
      newId,
    });
    expect(result.event.status).toBe('finalised');
    expect(result.event.attendance.map((a) => a.memberId)).toEqual(['a', 'b', 'c', 'd']);
    expect(result.issued).toHaveLength(1);
    expect(result.issued[0]).toMatchObject({ memberId: 'b', sourceEventId: 'e1', totalEvents: 2, remainingEvents: 2 });
    expect(result.event.suspensionIdsIssued).toEqual([result.issued[0]!.id]);
  });

  it('treats a missing attendance record for a starter as absent without notice', () => {
    const event = lockedEvent('e1', '2026-02-01', { a: 'core' });
    const result = finaliseEvent({ event, attendance: [], suspensions: [], settings, nowIso: 'now', newId });
    expect(result.issued.map((s) => s.memberId)).toEqual(['a']);
  });

  it('applies to R4 members exactly like everyone else', () => {
    const r4 = makeMember({ id: 'r4', rank: 'R4' });
    const event = lockedEvent('e1', '2026-02-01', { [r4.id]: 'core' });
    const result = finaliseEvent({ event, attendance: [att('r4', false)], suspensions: [], settings, nowIso: 'now', newId });
    expect(result.issued.map((s) => s.memberId)).toEqual(['r4']);
  });

  it('issues nothing when suspensionEvents is 0', () => {
    const event = lockedEvent('e1', '2026-02-01', { a: 'core' });
    const result = finaliseEvent({ event, attendance: [], suspensions: [], settings: makeSettings({ suspensionEvents: 0 }), nowIso: 'now', newId });
    expect(result.issued).toEqual([]);
  });

  it('refuses to finalise twice or before selection', () => {
    const event = lockedEvent('e1', '2026-02-01', {});
    expect(() => finaliseEvent({ event: { ...event, status: 'finalised' }, attendance: [], suspensions: [], settings, nowIso: 'n', newId })).toThrow('already finalised');
    expect(() => finaliseEvent({ event: { ...event, status: 'registration' }, attendance: [], suspensions: [], settings, nowIso: 'n', newId })).toThrow('Run the selection');
  });
});

describe('suspension countdown', () => {
  it('counts down once per finalised Team A event; new suspensions start counting at the NEXT event', () => {
    const settings = makeSettings({ suspensionEvents: 2, coreStarters: 1, rotationStarters: 0, substitutes: 5 });
    const members = [makeMember({ id: 'flaky', power: 300_000_000 }), makeMember({ id: 'b' })];
    let suspensions: Suspension[] = [];

    // Event 1: flaky is core and no-shows without notice -> suspended for 2 events.
    const e1 = finaliseEvent({ event: lockedEvent('e1', '2026-03-01', { flaky: 'core', b: 'substitute' }), attendance: [att('b', true)], suspensions, settings, nowIso: 't1', newId });
    suspensions = e1.suspensions;
    expect(remainingSuspension('flaky', suspensions)).toBe(2);

    // Event 2: flaky registers but is excluded; finalising counts down to 1.
    const sel2 = runSelection({ members, registrations: members.map((m) => ({ memberId: m.id, source: 'manual' })), history: [e1.event], suspensions, settings });
    expect(sel2.assignments.find((a) => a.memberId === 'flaky')!.slot).toBe('notSelected');
    const e2 = finaliseEvent({ event: lockedEvent('e2', '2026-03-08', { b: 'core' }), attendance: [att('b', true)], suspensions, settings, nowIso: 't2', newId });
    suspensions = e2.suspensions;
    expect(remainingSuspension('flaky', suspensions)).toBe(1);
    expect(isSuspended('flaky', suspensions)).toBe(true);

    // Event 3: still excluded; finalising counts down to 0.
    const e3 = finaliseEvent({ event: lockedEvent('e3', '2026-03-15', { b: 'core' }), attendance: [att('b', true)], suspensions, settings, nowIso: 't3', newId });
    suspensions = e3.suspensions;
    expect(isSuspended('flaky', suspensions)).toBe(false);

    // Event 4: eligible again.
    const sel4 = runSelection({ members, registrations: members.map((m) => ({ memberId: m.id, source: 'manual' })), history: [e1.event, e2.event, e3.event], suspensions, settings });
    expect(sel4.assignments.find((a) => a.memberId === 'flaky')!.slot).not.toBe('notSelected');
  });

  it('does not count below zero and ignores lifted suspensions', () => {
    const list = [
      makeSuspension({ id: 'a', memberId: 'x', remainingEvents: 0 }),
      makeSuspension({ id: 'b', memberId: 'y', remainingEvents: 2, liftedAt: '2026-01-01' }),
      makeSuspension({ id: 'c', memberId: 'z', remainingEvents: 1 }),
    ];
    expect(countDownSuspensions(list).map((s) => s.remainingEvents)).toEqual([0, 2, 0]);
  });

  it('can be lifted early by an R4', () => {
    const list = [makeSuspension({ id: 'a', memberId: 'x', remainingEvents: 2 })];
    expect(isSuspended('x', liftSuspensions('x', list, 'now'))).toBe(false);
  });
});
