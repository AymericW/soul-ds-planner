import { describe, expect, it } from 'vitest';
import {
  addRegistrations,
  applySelectionToEvent,
  isEventOver,
  lockEvent,
  markAttendedMany,
  registrationDrift,
  setAttended,
  setNotified,
  setRegistered,
  syncPlanWithRegistrations,
} from '@/domain/events/eventLifecycle';
import { createWeekEvent, lastFinalisedWeekKey, missingWeekEvents, openWeekKeys, upcomingEventDate, weekEventId, weekEventsByKey, weekKeyOf } from '@/domain/events/weekEvents';
import { buildPlanText } from '@/domain/selection/planText';
import { makeFinalisedEvent, makeMember, makeSettings } from '../fixtures';

const T = '2026-02-01T10:00:00.000Z';

describe('event lifecycle', () => {
  it('opens attendance only from the event day', () => {
    const e = createWeekEvent('2026-02-06', 'A', T);
    expect(isEventOver(e, '2026-02-02')).toBe(false);
    expect(isEventOver(e, '2026-02-06')).toBe(true);
    expect(isEventOver(e, '2026-02-07')).toBe(true);
  });

  it('finds the open weeks (oldest first) and the events of a week by slot', () => {
    const done = makeFinalisedEvent('old', '2026-01-02', {}, []);
    const openA = createWeekEvent('2026-01-09', 'A', T);
    const openB = createWeekEvent('2026-01-09', 'B', T);
    const later = createWeekEvent('2026-01-16', 'A', T);
    expect(openWeekKeys([later, done, openA, openB])).toEqual(['2026-01-05', '2026-01-12']);
    expect(weekEventsByKey([done, openA, openB, later], weekKeyOf(openA))).toEqual({ A: openA, B: openB });
    expect(openWeekKeys([done])).toEqual([]);
    expect(lastFinalisedWeekKey([done, openA])).toBe('2025-12-29');
  });

  it('adds OCR registrations without duplicates and toggles manual ones', () => {
    let e = createWeekEvent('2026-02-01', 'A', T);
    e = addRegistrations(e, ['a', 'b', 'a'], 'ocr', T);
    e = setRegistered(e, 'c', true, 'manual', T);
    e = setRegistered(e, 'a', false, 'manual', T);
    expect(e.registrations).toEqual([
      { memberId: 'b', source: 'ocr' },
      { memberId: 'c', source: 'manual' },
    ]);
  });

  it('detects registrations changed after the selection and syncs late ones as substitutes', () => {
    let e = addRegistrations(createWeekEvent('2026-02-01', 'A', T), ['a', 'b'], 'manual', T);
    e = applySelectionToEvent(
      e,
      [
        { memberId: 'a', slot: 'core', order: 0, reason: '' },
        { memberId: 'b', slot: 'substitute', order: 0, reason: '' },
      ],
      makeSettings(),
      T,
    );
    e = setRegistered(setRegistered(e, 'c', true, 'manual', T), 'b', false, 'manual', T);
    expect(registrationDrift(e)).toEqual({ lateAdds: ['c'], withdrawn: ['b'] });
    const synced = syncPlanWithRegistrations(e, T);
    expect(synced.assignments.map((a) => [a.memberId, a.slot])).toEqual([
      ['a', 'core'],
      ['c', 'substitute'],
    ]);
  });

  it('records attendance only for the lineup and clears "notified" for attendees', () => {
    let e = applySelectionToEvent(
      createWeekEvent('2026-02-01', 'A', T),
      [
        { memberId: 'a', slot: 'core', order: 0, reason: '' },
        { memberId: 'x', slot: 'notSelected', order: 0, reason: '' },
      ],
      makeSettings(),
      T,
    );
    e = lockEvent(e, T);
    e = markAttendedMany(e, ['a', 'x', 'ghost'], T);
    expect(e.attendance).toEqual([{ memberId: 'a', attended: true, notified: false }]);
    e = setAttended(e, 'a', false, T);
    e = setNotified(e, 'a', true, T);
    expect(e.attendance).toEqual([{ memberId: 'a', attended: false, notified: true }]);
  });

  it('builds a plan text for the alliance chat', () => {
    const e = applySelectionToEvent(
      createWeekEvent('2026-10-05', 'A', T),
      [
        { memberId: 'a', slot: 'core', order: 0, reason: '' },
        { memberId: 'b', slot: 'substitute', order: 0, reason: '' },
      ],
      makeSettings(),
      T,
    );
    const text = buildPlanText(e, [makeMember({ id: 'a', name: 'Alpha' }), makeMember({ id: 'b', name: 'Bravo' })]);
    expect(text).toContain('Desert Storm Team A – Mon 5 Oct 2026, 10 PM (Paris time)');
    expect(text).toContain('CORE (1): Alpha');
    expect(text).toContain('SUBSTITUTES (1, in call-in order): 1. Bravo');
  });
});

describe('two events per week (Team A / Team B)', () => {
  it('uses the upcoming Friday in Paris time: today when it is Friday, else the next one', () => {
    // Sunday 11 Oct 2026 -> Friday 16 Oct
    expect(upcomingEventDate(new Date('2026-10-11T12:00:00Z'))).toBe('2026-10-16');
    // Friday 16 Oct, 21:30 UTC = 23:30 Paris (still Friday) -> today
    expect(upcomingEventDate(new Date('2026-10-16T21:30:00Z'))).toBe('2026-10-16');
    // Friday 16 Oct, 22:30 UTC = Saturday 00:30 Paris -> next Friday
    expect(upcomingEventDate(new Date('2026-10-16T22:30:00Z'))).toBe('2026-10-23');
  });

  it('creates the missing A and B events with deterministic ids, idempotently', () => {
    const created = missingWeekEvents([], '2026-10-16', T);
    expect(created.map((e) => [e.id, e.slot, e.label])).toEqual([
      ['2026-10-16-A', 'A', 'Desert Storm Team A – Fri 16 Oct 2026'],
      ['2026-10-16-B', 'B', 'Desert Storm Team B – Fri 16 Oct 2026'],
    ]);
    expect(missingWeekEvents(created, '2026-10-16', T)).toEqual([]);
    expect(missingWeekEvents([created[0]!], '2026-10-16', T).map((e) => e.id)).toEqual([weekEventId('2026-10-16', 'B')]);
  });

  it('keeps a late registration out of the substitutes when they start in the other event', () => {
    const settings = makeSettings();
    const other = applySelectionToEvent(createWeekEvent('2026-10-16', 'B', T), [{ memberId: 'c', slot: 'core', order: 0, reason: '' }], settings, T);
    let e = applySelectionToEvent(addRegistrations(createWeekEvent('2026-10-16', 'A', T), ['a'], 'manual', T), [{ memberId: 'a', slot: 'core', order: 0, reason: '' }], settings, T);
    e = addRegistrations(e, ['c', 'd'], 'self', T);
    const synced = syncPlanWithRegistrations(e, T, [other]);
    expect(synced.assignments.map((a) => [a.memberId, a.slot])).toEqual([
      ['a', 'core'],
      ['d', 'substitute'],
      ['c', 'notSelected'],
    ]);
    expect(synced.assignments.find((a) => a.memberId === 'c')!.reason).toContain('Starter in Team B');
  });
});
