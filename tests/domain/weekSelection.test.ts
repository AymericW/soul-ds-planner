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

/** The week-level invariant that must always hold: nobody is listed (starter or substitute) in both events. */
function expectNoDoubleBooking(a: SelectionResult | undefined, b: SelectionResult | undefined) {
  for (const id of listedOf(a)) expect(listedOf(b)).not.toContain(id);
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

  it('never makes a substitute-only player a substitute in both events', () => {
    const members = roster(5);
    const { results } = selectWeek(input(members, [event('A', ['p1', 'p2', 'p3', 'p5'], ['p5']), event('B', ['p1', 'p4', 'p5'], ['p5'])]));
    const subIn = [slots(results.A).substitute.includes('p5'), slots(results.B).substitute.includes('p5')];
    expect(subIn.filter(Boolean)).toHaveLength(1);
    expectNoDoubleBooking(results.A, results.B);
  });

  it('never makes a "play" player who missed a starter place a substitute in both events', () => {
    const members = roster(10);
    // Both events are over-subscribed: p4..p6 miss a starter place in both and would be subs twice.
    const all = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10'];
    const { results } = selectWeek(input(members, [event('A', all), event('B', all)]));
    expectNoDoubleBooking(results.A, results.B);
    expect(startersOf(results.A)).toHaveLength(3);
    expect(startersOf(results.B)).toHaveLength(3);
    expect(slots(results.A).substitute).toHaveLength(2);
    expect(slots(results.B).substitute).toHaveLength(2);
    const b = results.B!.assignments.find((a) => slots(results.A).substitute.includes(a.memberId))!;
    expect(b.slot).toBe('notSelected');
    expect(b.reason).toBe('Substitute in Team A this week');
  });
});

describe('week selection: re-running one event respects the other', () => {
  const members = roster(6);

  it('excludes the starters and substitutes of an already planned other event', () => {
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
    expect(slots(results.A).notSelected).toEqual(['p1', 'p2']);
    expect(results.A!.assignments.find((a) => a.memberId === 'p1')!.reason).toBe('Starter in Team B this week');
    expect(results.A!.assignments.find((a) => a.memberId === 'p2')!.reason).toBe('Substitute in Team B this week');
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

  it('refuses any place here to a substitute of the other event', () => {
    const b = planned('B', [['y', 'substitute']]);
    expect(placementConflict('y', 'substitute', [b])).toContain('only be a substitute for one event');
    expect(placementConflict('y', 'rotation', [b])).toContain('Substitute in Team B this week');
    expect(placementConflict('y', 'notSelected', [b])).toBeNull();
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

describe('week selection: the "Run A + B" and "Run one team" buttons never share a player', () => {
  /** Same logic as runWeeklySelection in useWeeklyEventViewModel: compute, then save only the saved scope. */
  function press(week: Record<EventSlot, WeekEvent>, members: Member[], slot: EventSlot, scope: 'this' | 'both'): Record<EventSlot, WeekEvent> {
    const other: EventSlot = slot === 'A' ? 'B' : 'A';
    const editable = (e: WeekEvent) => e.status === 'registration' || e.status === 'planned';
    const together = (scope === 'both' ? editable(week[other]) : week[other].status === 'registration') ? [other] : [];
    const weekEvents = [week[slot], week[other]];
    const { results } = selectWeek({ members, events: weekEvents, weekEvents, targets: [slot, ...together], suspensions: [], settings });
    const next = { ...week };
    for (const s of scope === 'both' ? [slot, ...together] : [slot]) next[s] = applySelectionToEvent(week[s], results[s]!.assignments, settings, T);
    return next;
  }

  const listedIn = (e: WeekEvent) => e.assignments.filter((a) => a.slot !== 'notSelected').map((a) => a.memberId);
  const expectDisjoint = (week: Record<EventSlot, WeekEvent>) => {
    const b = new Set(listedIn(week.B));
    expect(listedIn(week.A).filter((id) => b.has(id))).toEqual([]);
  };

  // Deterministic pseudo-random sign-up mixes: play / sub only / not registered, per team.
  function weeks(): Array<{ members: Member[]; week: Record<EventSlot, WeekEvent> }> {
    let seed = 7;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    return Array.from({ length: 40 }, () => {
      const members = roster(4 + Math.floor(rand() * 9));
      const pick = () => {
        const ids: string[] = [];
        const subs: string[] = [];
        for (const m of members) {
          const r = rand();
          if (r < 0.55) ids.push(m.id);
          else if (r < 0.8) (ids.push(m.id), subs.push(m.id));
        }
        return { ids, subs };
      };
      const a = pick();
      const b = pick();
      return { members, week: { A: event('A', a.ids, a.subs), B: event('B', b.ids, b.subs) } };
    });
  }

  const flows: Array<[string, Array<[EventSlot, 'this' | 'both']>]> = [
    ['Run A + B', [['A', 'both']]],
    ['Run A + B from Team B', [['B', 'both']]],
    ['Run Team A only, then Team B only', [['A', 'this'], ['B', 'this']]],
    ['Run Team B only, then Team A only', [['B', 'this'], ['A', 'this']]],
    ['Run A + B, then re-run Team A only', [['A', 'both'], ['A', 'this']]],
    ['Run A + B, then re-run Team B only', [['A', 'both'], ['B', 'this']]],
    ['Run Team A only, then Run A + B', [['A', 'this'], ['A', 'both']]],
  ];

  for (const [name, steps] of flows) {
    it(name, () => {
      for (const { members, week: start } of weeks()) {
        let week = start;
        for (const [slot, scope] of steps) {
          week = press(week, members, slot, scope);
          expectDisjoint(week);
        }
      }
    });
  }
});
