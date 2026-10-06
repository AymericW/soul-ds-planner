import { describe, expect, it } from 'vitest';
import {
  addRegistrations,
  applySelectionToEvent,
  createWeekEvent,
  currentOpenEvent,
  isEventOver,
  lockEvent,
  markAttendedMany,
  registrationDrift,
  setAttended,
  setNotified,
  setRegistered,
  syncPlanWithRegistrations,
} from '@/domain/events/eventLifecycle';
import { buildPlanText } from '@/domain/selection/planText';
import { makeFinalisedEvent, makeMember, makeSettings } from '../fixtures';

const T = '2026-02-01T10:00:00.000Z';

describe('event lifecycle', () => {
  it('opens attendance only from the event day', () => {
    const e = createWeekEvent('e', '2026-02-06', T);
    expect(isEventOver(e, '2026-02-02')).toBe(false);
    expect(isEventOver(e, '2026-02-06')).toBe(true);
    expect(isEventOver(e, '2026-02-07')).toBe(true);
  });

  it('finds the open event (latest non-finalised)', () => {
    const done = makeFinalisedEvent('old', '2026-01-01', {}, []);
    const open = createWeekEvent('new', '2026-01-08', T);
    expect(currentOpenEvent([done, open])?.id).toBe('new');
    expect(currentOpenEvent([done])).toBeUndefined();
  });

  it('adds OCR registrations without duplicates and toggles manual ones', () => {
    let e = createWeekEvent('e', '2026-02-01', T);
    e = addRegistrations(e, ['a', 'b', 'a'], 'ocr', T);
    e = setRegistered(e, 'c', true, 'manual', T);
    e = setRegistered(e, 'a', false, 'manual', T);
    expect(e.registrations).toEqual([
      { memberId: 'b', source: 'ocr' },
      { memberId: 'c', source: 'manual' },
    ]);
  });

  it('detects registrations changed after the selection and syncs late ones as substitutes', () => {
    let e = addRegistrations(createWeekEvent('e', '2026-02-01', T), ['a', 'b'], 'manual', T);
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
      createWeekEvent('e', '2026-02-01', T),
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
      createWeekEvent('e', '2026-10-05', T),
      [
        { memberId: 'a', slot: 'core', order: 0, reason: '' },
        { memberId: 'b', slot: 'substitute', order: 0, reason: '' },
      ],
      makeSettings(),
      T,
    );
    const text = buildPlanText(e, [makeMember({ id: 'a', name: 'Alpha' }), makeMember({ id: 'b', name: 'Bravo' })]);
    expect(text).toContain('Mon 5 Oct 2026');
    expect(text).toContain('CORE (1): Alpha');
    expect(text).toContain('SUBSTITUTES (1, in call-in order): 1. Bravo');
  });
});
