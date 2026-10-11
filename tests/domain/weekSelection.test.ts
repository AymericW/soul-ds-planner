import { describe, expect, it } from 'vitest';
import { applySelectionToEvent, lockEvent, setAttended } from '@/domain/events/eventLifecycle';
import { createWeekEvent } from '@/domain/events/weekEvents';
import { attendanceConflict, placementConflict } from '@/domain/selection/weekConflicts';
import { selectWeek, type WeekSelectionInput } from '@/domain/selection/weekSelection';
import { isStarterSlot, type Slot } from '@/models/Assignment';
import type { Member } from '@/models/Member';
import type { Registration } from '@/models/Registration';
import type { EventSlot, WeekEvent } from '@/models/WeekEvent';
import type { SelectionResult } from '@/domain/selection/runSelection';
import { makeFinalisedEvent, makeMember, makeSettings } from '../fixtures';

const T = '2026-10-12T10:00:00.000Z';
const FRIDAY = '2026-10-16';
const settings = makeSettings({ coreStarters: 2, rotationStarters: 1, substitutes: 2 }); // 3 starters, 5 places

/** p1 strongest … pN weakest, all activity 3. */
const roster = (n: number): Member[] =>
  Array.from({ length: n }, (_, i) => makeMember({ id: `p${i + 1}`, name: `P${String(i + 1).padStart(2, '0')}`, power: (200 - i) * 1_000_000 }));

const reg = (ids: string[], sub: string[] = []): Registration[] =>
  ids.map((memberId) => ({ memberId, source: 'manual' as const, ...(sub.includes(memberId) ? { substituteOnly: true } : {}) }));

function event(slot: EventSlot, ids: string[], sub: string[] = []): WeekEvent {
  return { ...createWeekEvent(FRIDAY, slot, T), registrations: reg(ids, sub) };
}

function slots(result: SelectionResult | undefined): Record<Slot, string[]> {
  const out: Record<Slot, string[]> = { core: [], rotation: [], substitute: [], notSelected: [] };
  for (const a of [...(result?.assignments ?? [])].sort((x, y) => x.order - y.order)) out[a.slot].push(a.memberId);
  return out;
}

const startersOf = (r: SelectionResult | undefined) => (r?.assignments ?? []).filter((a) => isStarterSlot(a.slot)).map((a) => a.memberId);
const listedOf = (r: SelectionResult | undefined) => (r?.assignments ?? []).filter((a) => a.slot !== 'notSelected').map((a) => a.memberId);

function input(members: Member[], weekEvents: WeekEvent[], targets: EventSlot[] = ['A', 'B'], events: WeekEvent[] = []): WeekSelectionInput {
  return { members, events: [...events, ...weekEvents], weekEvents, targets, suspensions: [], settings };
}

/** The week-level invariants that must always hold. */
function expectNoDoubleBooking(a: SelectionResult | undefined, b: SelectionResult | undefined) {
  for (const id of startersOf(a)) expect(listedOf(b)).not.toContain(id);
  for (const id of startersOf(b)) expect(listedOf(a)).not.toContain(id);
}

describe('week selection: one player, one game per week', () => {
  it('a single player registered for both is never on both boards', () => {
    const members = roster(1);
    const { results } = selectWeek(input(members, [event('A', ['p1']), event('B', ['p1'])]));
    expect(startersOf(results.A).length + startersOf(results.B).length).toBe(1);
    expectNoDoubleBooking(results.A, results.B);
  });

  it('nobody is a starter in both, with large overlapping pools', () => {
    const members = roster(12);
    const all = members.map((m) => m.id);
    const { results } = selectWeek(input(members, [event('A', all), event('B', all.slice(2))]));
    expectNoDoubleBooking(results.A, results.B);
    expect(startersOf(results.A)).toHaveLength(3);
    expect(startersOf(results.B)).toHaveLength(3);
  });

  it('resolves the scarcer event first so a shortage is filled by contested players', () => {
    const members = roster(8);
    // A: p1..p6 (plenty, 6 for 3 starter places). B: only p1, p2 and exclusive p7 (3 for 3).
    const { results, order } = selectWeek(input(members, [event('A', ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']), event('B', ['p1', 'p2', 'p7'])]));
    expect(order).toEqual(['B', 'A']);
    expect(startersOf(results.B).sort()).toEqual(['p1', 'p2', 'p7']);
    expect(startersOf(results.A).sort()).toEqual(['p3', 'p4', 'p5']);
    expect(slots(results.A).notSelected).toEqual(expect.arrayContaining(['p1', 'p2']));
    expect(results.A!.assignments.find((a) => a.memberId === 'p1')!.reason).toContain('Starter in Team B this week');
  });

  it('breaks a scarcity tie in favour of Team A (deterministic)', () => {
    const members = roster(3);
    const week = [event('A', ['p1', 'p2', 'p3']), event('B', ['p1', 'p2', 'p3'])];
    const first = selectWeek(input(members, week));
    expect(first.order).toEqual(['A', 'B']);
    expect(startersOf(first.results.A)).toEqual(['p1', 'p2', 'p3']);
    expect(selectWeek(input(members, week))).toEqual(first);
  });

  it('moves a contested player who only got a substitute place to a starter place in the other event', () => {
    const members = roster(7);
    // B is scarcer (4 for 3) and takes p1..p3 as starters, p4 would be its substitute.
    // A (5 for 3) needs p4 as a starter: p4 leaves B's substitutes.
    const { results } = selectWeek(input(members, [event('A', ['p1', 'p2', 'p4', 'p5', 'p6', 'p7']), event('B', ['p1', 'p2', 'p3', 'p4'])]));
    expect(startersOf(results.B).sort()).toEqual(['p1', 'p2', 'p3']);
    expect(startersOf(results.A)).toContain('p4');
    expect(listedOf(results.B)).not.toContain('p4');
    expectNoDoubleBooking(results.A, results.B);
  });

  it('allows a substitute-only player to be a substitute in both events', () => {
    const members = roster(5);
    const { results } = selectWeek(input(members, [event('A', ['p1', 'p2', 'p3', 'p5'], ['p5']), event('B', ['p1', 'p4', 'p5'], ['p5'])]));
    expect(slots(results.A).substitute).toContain('p5');
    expect(slots(results.B).substitute).toContain('p5');
    expectNoDoubleBooking(results.A, results.B);
  });
});

describe('week selection: re-running one event respects the other', () => {
  const members = roster(6);

  it('excludes the starters of an already planned other event and keeps its substitutes as substitutes only', () => {
    const planned = applySelectionToEvent(
      event('B', ['p1', 'p2']),
      [
        { memberId: 'p1', slot: 'core', order: 0, reason: '' },
        { memberId: 'p2', slot: 'substitute', order: 0, reason: '' },
      ],
      settings,
      T,
    );
    const { results } = selectWeek(input(members, [event('A', ['p1', 'p2', 'p3', 'p4']), planned], ['A']));
    expect(results.B).toBeUndefined();
    expect(slots(results.A).notSelected).toEqual(['p1']);
    expect(results.A!.assignments.find((a) => a.memberId === 'p1')!.reason).toBe('Starter in Team B this week');
    expect(startersOf(results.A)).not.toContain('p2');
    expect(slots(results.A).substitute).toEqual(['p2']);
    expect(results.A!.assignments.find((a) => a.memberId === 'p2')!.reason).toContain('Substitute in Team B this week');
  });

  it('excludes a player who already played in the finalised other event, even as a substitute', () => {
    let done = lockEvent(
      applySelectionToEvent(
        event('B', ['p1', 'p2']),
        [
          { memberId: 'p1', slot: 'core', order: 0, reason: '' },
          { memberId: 'p2', slot: 'substitute', order: 0, reason: '' },
        ],
        settings,
        T,
      ),
      T,
    );
    done = { ...setAttended(done, 'p2', true, T), status: 'finalised' };
    const { results } = selectWeek(input(members, [event('A', ['p2', 'p3'], ['p2']), done], ['A']));
    expect(slots(results.A).notSelected).toEqual(['p2']);
    expect(results.A!.assignments.find((a) => a.memberId === 'p2')!.reason).toBe('Already played in Team B this week');
  });

  it("ignores the same week's finalised event as history (rotation looks at earlier weeks only)", () => {
    const lastWeek = makeFinalisedEvent('2026-10-09-A', '2026-10-09', { p6: 'rotation' }, ['p6']);
    const thisWeekB = { ...makeFinalisedEvent('2026-10-16-B', FRIDAY, { p5: 'core' }, ['p5'], [], 'B') };
    const a = event('A', ['p1', 'p2', 'p4', 'p6']);
    const { results } = selectWeek({ ...input(members, [a, thisWeekB], ['A'], [lastWeek]), settings: makeSettings({ coreStarters: 2, rotationStarters: 1, substitutes: 1 }) });
    // p4 never played -> rotation before p6 who played last week.
    expect(slots(results.A).rotation).toEqual(['p4']);
    expect(results.A!.assignments.find((a) => a.memberId === 'p6')!.reason).toContain('played last week');
  });
});

describe('manual changes across Team A / Team B', () => {
  const planned = (slot: EventSlot, lineup: Array<[string, Slot]>) =>
    applySelectionToEvent(event(slot, lineup.map(([id]) => id)), lineup.map(([memberId, s], order) => ({ memberId, slot: s, order, reason: '' })), settings, T);

  it('blocks moving a starter of the other event into this lineup', () => {
    const b = planned('B', [['x', 'core']]);
    expect(placementConflict('x', 'core', [b])).toContain('Starter in Team B this week');
    expect(placementConflict('x', 'substitute', [b])).toContain('Starter in Team B this week');
    expect(placementConflict('x', 'notSelected', [b])).toBeNull();
  });

  it('lets a substitute of the other event be a substitute here but not a starter', () => {
    const b = planned('B', [['y', 'substitute']]);
    expect(placementConflict('y', 'substitute', [b])).toBeNull();
    expect(placementConflict('y', 'rotation', [b])).toContain('Substitute in Team B this week');
    expect(placementConflict('free', 'core', [b])).toBeNull();
  });

  it('blocks recording attendance for a player who already entered the other event', () => {
    let b = lockEvent(planned('B', [['z', 'substitute']]), T);
    expect(attendanceConflict('z', [b])).toBeNull();
    b = setAttended(b, 'z', true, T);
    expect(attendanceConflict('z', [b])).toContain('Already played in Team B this week');
    expect(placementConflict('z', 'substitute', [b])).toContain('only play one event per week');
  });
});
