import { EVENT_SLOT_INFO } from '@/constants/events';
import { finalisedWeeks, weeksBefore } from '@/domain/history/weekHistory';
import { isSuspended } from '@/domain/penalties/suspensions';
import { weekStart } from '@/helpers/dates';
import { isStarterSlot } from '@/models/Assignment';
import type { Member } from '@/models/Member';
import type { Settings } from '@/models/Settings';
import type { Suspension } from '@/models/Suspension';
import { EVENT_SLOTS, type EventSlot, type WeekEvent } from '@/models/WeekEvent';
import { runSelection, starterCount, type SelectionResult } from './runSelection';
import { commitmentIn, commitmentReason } from './weekConflicts';

export interface WeekSelectionInput {
  members: readonly Member[];
  /** All events (any status). Only finalised events of EARLIER weeks are used as history. */
  events: readonly WeekEvent[];
  /** The Team A / Team B events of the week being planned. */
  weekEvents: readonly WeekEvent[];
  /** Slots (re)computed now. The other event of the week is "fixed": its current plan is respected. */
  targets: readonly EventSlot[];
  suspensions: readonly Suspension[];
  settings: Settings;
}

export interface WeekSelectionResult {
  results: Partial<Record<EventSlot, SelectionResult>>;
  /** Order in which the targets were resolved (scarcer event first). */
  order: EventSlot[];
}

/**
 * Scarcity of an event = eligible starter applicants / starter places. Lower = more in need of players.
 * Players blocked or limited to substitute by a fixed event do not count.
 */
export function starterScarcity(
  event: WeekEvent,
  members: readonly Member[],
  suspensions: readonly Suspension[],
  settings: Settings,
  excluded: ReadonlySet<string>,
): number {
  const places = starterCount(settings);
  if (places === 0) return Number.POSITIVE_INFINITY;
  const byId = new Map(members.map((m) => [m.id, m]));
  const ids = new Set(
    event.registrations
      .filter((r) => !r.substituteOnly && !excluded.has(r.memberId))
      .map((r) => r.memberId)
      .filter((id) => byId.get(id)?.active && !isSuspended(id, suspensions)),
  );
  return ids.size / places;
}

const listed = (r: SelectionResult, id: string) => r.assignments.some((a) => a.memberId === id && a.slot !== 'notSelected');
const starters = (r: SelectionResult) => r.assignments.filter((a) => isStarterSlot(a.slot)).map((a) => a.memberId);

/**
 * Week-level selection for Team A and Team B (pure and deterministic).
 *
 * 1. Fixed events (not in `targets`) are respected: their starters and players who already
 *    entered are excluded from the targets; their listed substitutes may only be substitutes.
 * 2. With two targets, the SCARCER event (fewest eligible starter applicants per starter place;
 *    tie -> Team A) is resolved first and keeps its starters. The other event is then selected
 *    without those starters.
 * 3. A player contested by both who becomes a starter in the second event while only being a
 *    substitute in the first is removed from the first event's substitutes (where they help fill
 *    a board), and the first event is recomputed. This repeats until stable (the excluded set only
 *    grows, so it always ends).
 *
 * Invariants of the result: nobody is a starter in both events, and a starter of one event is
 * never listed (starter or substitute) in the other. Substitutes may be listed in both.
 */
export function selectWeek(input: WeekSelectionInput): WeekSelectionResult {
  const { members, suspensions, settings } = input;
  const bySlot = new Map(input.weekEvents.map((e) => [e.slot, e]));
  const targets = EVENT_SLOTS.filter((s) => input.targets.includes(s) && bySlot.has(s));
  const fixed = input.weekEvents.filter((e) => !targets.includes(e.slot));
  const anyEvent = input.weekEvents[0];
  const weeks = anyEvent ? weeksBefore(finalisedWeeks(input.events), weekStart(anyEvent.date)) : [];

  // Constraints coming from the fixed event(s).
  const fixedBlocked = new Map<string, string>();
  const fixedSubOnly = new Map<string, string>();
  for (const event of input.weekEvents) {
    for (const r of event.registrations) {
      const c = commitmentIn(fixed, r.memberId);
      if (!c) continue;
      if (c.kind === 'substitute') fixedSubOnly.set(r.memberId, commitmentReason(c));
      else fixedBlocked.set(r.memberId, commitmentReason(c));
    }
  }

  const run = (slot: EventSlot, blocked: ReadonlyMap<string, string>) =>
    runSelection({
      members,
      registrations: bySlot.get(slot)!.registrations,
      history: [],
      weeks,
      suspensions,
      settings,
      blocked,
      substituteOnly: fixedSubOnly,
    });

  if (targets.length <= 1) {
    const results: WeekSelectionResult['results'] = {};
    for (const slot of targets) results[slot] = run(slot, fixedBlocked);
    return { results, order: targets };
  }

  const excluded = new Set([...fixedBlocked.keys(), ...fixedSubOnly.keys()]);
  const order = [...targets].sort(
    (a, b) =>
      starterScarcity(bySlot.get(a)!, members, suspensions, settings, excluded) -
        starterScarcity(bySlot.get(b)!, members, suspensions, settings, excluded) || EVENT_SLOTS.indexOf(a) - EVENT_SLOTS.indexOf(b),
  );
  const [first, second] = order as [EventSlot, EventSlot];
  const firstTeam = EVENT_SLOT_INFO[first].team;
  const secondTeam = EVENT_SLOT_INFO[second].team;

  const firstBlocked = new Map(fixedBlocked);
  let resultFirst = run(first, firstBlocked);
  let resultSecond: SelectionResult;
  // Each extra round adds at least one member to firstBlocked, so this ends.
  for (let round = 0; ; round++) {
    const secondBlocked = new Map(fixedBlocked);
    for (const id of starters(resultFirst)) secondBlocked.set(id, `Starter in ${firstTeam} this week`);
    resultSecond = run(second, secondBlocked);
    const moved = starters(resultSecond).filter((id) => listed(resultFirst, id) && !firstBlocked.has(id));
    if (moved.length === 0 || round > members.length) break;
    for (const id of moved) firstBlocked.set(id, `Starter in ${secondTeam} this week`);
    resultFirst = run(first, firstBlocked);
  }
  return { results: { [first]: resultFirst, [second]: resultSecond }, order };
}
