import { eventsSinceLastPlayed, finalisedEventsChronological, playedLastEvent } from '@/domain/history/eventHistory';
import { computeRelativeScores } from '@/domain/scoring/relativeScore';
import { formatEventsAgo } from '@/helpers/format';
import type { Assignment, Slot } from '@/models/Assignment';
import type { Member } from '@/models/Member';
import type { Registration } from '@/models/Registration';
import type { Settings } from '@/models/Settings';
import type { Suspension } from '@/models/Suspension';
import type { WeekEvent } from '@/models/WeekEvent';
import type { Candidate } from './candidates';
import { selectCore } from './core';
import { splitEligibility } from './eligibility';
import { selectRotation } from './rotation';
import { selectSubstitutes } from './substitutes';

export interface SelectionInput {
  members: readonly Member[];
  registrations: readonly Registration[];
  /** All events; only finalised ones are used as history. */
  history: readonly WeekEvent[];
  suspensions: readonly Suspension[];
  settings: Settings;
}

export interface SelectionResult {
  assignments: Assignment[];
  summary: {
    applicants: number;
    eligible: number;
    cap: number;
    overCap: boolean;
  };
}

export function registrationCap(settings: Settings): number {
  return Math.max(0, settings.coreStarters) + Math.max(0, settings.rotationStarters) + Math.max(0, settings.substitutes);
}

export function starterCount(settings: Settings): number {
  return Math.max(0, settings.coreStarters) + Math.max(0, settings.rotationStarters);
}

function pct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

function historyNote(c: Candidate): string {
  if (c.eventsSinceLastPlayed === null) return 'never played yet';
  if (c.playedLastEvent) return 'played last event';
  return `didn't play last event (last played ${formatEventsAgo(c.eventsSinceLastPlayed)})`;
}

/**
 * The weekly selection, deterministic and side-effect free:
 * eligible applicants -> core (relative score) -> rotation (priority) ->
 * substitutes (priority) -> not selected (over the cap). Under the cap nobody is cut.
 */
export function runSelection(input: SelectionInput): SelectionResult {
  const { members, registrations, history, suspensions, settings } = input;
  const { eligible, ineligible } = splitEligibility(registrations, members, suspensions);
  const chronological = finalisedEventsChronological(history);
  const scores = computeRelativeScores(eligible, settings.weights);

  const candidates: Candidate[] = eligible.map((member) => ({
    member,
    score: scores.get(member.id)!,
    playedLastEvent: playedLastEvent(chronological, member.id),
    eventsSinceLastPlayed: eventsSinceLastPlayed(chronological, member.id),
  }));

  const { core, rest: afterCore } = selectCore(candidates, settings.coreStarters, settings.scoreEpsilon);
  const { rotation, rest: afterRotation } = selectRotation(afterCore, settings.rotationStarters);
  const { substitutes, notSelected } = selectSubstitutes(afterRotation, settings.substitutes);
  const cap = registrationCap(settings);

  const assignments: Assignment[] = [];
  const push = (slot: Slot, list: Candidate[], reason: (c: Candidate, i: number) => string) =>
    list.forEach((c, i) =>
      assignments.push({ memberId: c.member.id, slot, order: i, reason: reason(c, i), score: round3(c.score.score) }),
    );

  push(
    'core',
    core,
    (c, i) =>
      `Core #${i + 1} · score ${c.score.score.toFixed(2)} (power ${pct(c.score.powerRatio)} of top, activity ${c.member.activity}/5)`,
  );
  push('rotation', rotation, (c, i) => `Rotation #${i + 1} · ${historyNote(c)}`);
  push('substitute', substitutes, (c, i) => `Substitute #${i + 1} · ${historyNote(c)}`);
  push('notSelected', notSelected, (c) => `Over the cap of ${cap} · lower rotation priority (${historyNote(c)})`);
  ineligible.forEach((x, i) =>
    assignments.push({ memberId: x.memberId, slot: 'notSelected', order: notSelected.length + i, reason: x.reason }),
  );

  return {
    assignments,
    summary: {
      applicants: eligible.length + ineligible.length,
      eligible: eligible.length,
      cap,
      overCap: eligible.length > cap,
    },
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
