import { finalisedWeeks, playedLastWeek, weeksSinceLastPlayed, type WeekRecord } from '@/domain/history/weekHistory';
import { computeRelativeScores } from '@/domain/scoring/relativeScore';
import { formatWeeksAgo } from '@/helpers/format';
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
  /** Events used as history; only finalised ones count, grouped by week (Team A + Team B). */
  history: readonly WeekEvent[];
  suspensions: readonly Suspension[];
  settings: Settings;
  /** Precomputed history weeks (overrides `history`; used by the week-level selection). */
  weeks?: readonly WeekRecord[];
  /** Registered members who must not get any place here (memberId -> reason), e.g. starter in the other event. */
  blocked?: ReadonlyMap<string, string>;
  /** Registered members who may only be substitutes here (memberId -> reason), e.g. substitute in the other event. */
  substituteOnly?: ReadonlyMap<string, string>;
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
  if (c.weeksSinceLastPlayed === null) return 'never played yet';
  if (c.playedLastWeek) return 'played last week';
  return `didn't play last week (last played ${formatWeeksAgo(c.weeksSinceLastPlayed)})`;
}

/**
 * The selection of ONE event, deterministic and side-effect free:
 * eligible applicants -> core (relative score) -> rotation (priority) ->
 * substitutes (leftover starter applicants first, then substitute-only volunteers) ->
 * not selected (more registrations than places). With no more registrations than places, nobody is cut.
 * Cross-event rules (Team A vs Team B of the same week) are applied by `selectWeek` through
 * `blocked` and `substituteOnly`.
 */
export function runSelection(input: SelectionInput): SelectionResult {
  const { members, history, suspensions, settings } = input;
  const blocked = input.blocked ?? new Map<string, string>();
  const forcedSub = input.substituteOnly ?? new Map<string, string>();
  const known = new Set(members.map((m) => m.id));
  const seenBlocked = new Set<string>();
  const blockedApplicants: Array<{ memberId: string; reason: string }> = [];
  const registrations = input.registrations.filter((r) => {
    if (!blocked.has(r.memberId)) return true;
    if (known.has(r.memberId) && !seenBlocked.has(r.memberId)) {
      seenBlocked.add(r.memberId);
      blockedApplicants.push({ memberId: r.memberId, reason: blocked.get(r.memberId)! });
    }
    return false;
  });

  const { eligible, ineligible } = splitEligibility(registrations, members, suspensions);
  const weeks = input.weeks ?? finalisedWeeks(history);
  const volunteerIds = new Set(registrations.filter((r) => r.substituteOnly || forcedSub.has(r.memberId)).map((r) => r.memberId));
  const volunteers = eligible.filter((m) => volunteerIds.has(m.id));
  const applicants = eligible.filter((m) => !volunteerIds.has(m.id));
  // Substitute-only volunteers must not skew the "top power" the starters are compared against.
  const scores = new Map([...computeRelativeScores(volunteers, settings.weights), ...computeRelativeScores(applicants, settings.weights)]);

  const toCandidate = (member: Member): Candidate => ({
    member,
    score: scores.get(member.id)!,
    playedLastWeek: playedLastWeek(weeks, member.id),
    weeksSinceLastPlayed: weeksSinceLastPlayed(weeks, member.id),
  });

  const { core, rest: afterCore } = selectCore(applicants.map(toCandidate), settings.coreStarters, settings.scoreEpsilon);
  const { rotation, rest: afterRotation } = selectRotation(afterCore, settings.rotationStarters);
  // Starter applicants who missed a starter slot take the substitute places first;
  // substitute-only volunteers only get whatever places are left over.
  const otherSubs = selectSubstitutes(afterRotation, settings.substitutes);
  const volunteerSubs = selectSubstitutes(volunteers.map(toCandidate), Math.max(0, settings.substitutes) - otherSubs.substitutes.length);
  const substitutes = [...otherSubs.substitutes, ...volunteerSubs.substitutes];
  const notSelected = [...otherSubs.notSelected, ...volunteerSubs.notSelected];
  const cap = registrationCap(settings);
  const volunteerNote = (id: string) => forcedSub.get(id) ?? 'volunteered as substitute';

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
  push(
    'substitute',
    substitutes,
    (c, i) => `Substitute #${i + 1} · ${volunteerIds.has(c.member.id) ? volunteerNote(c.member.id) : historyNote(c)}`,
  );
  push('notSelected', notSelected, (c) =>
    volunteerIds.has(c.member.id)
      ? `${forcedSub.has(c.member.id) ? `Substitute only (${volunteerNote(c.member.id)})` : 'Volunteered as substitute'} · all ${Math.max(0, settings.substitutes)} substitute places are taken`
      : `No place left (${cap} places) · lower rotation priority (${historyNote(c)})`,
  );
  [...ineligible, ...blockedApplicants].forEach((x, i) =>
    assignments.push({ memberId: x.memberId, slot: 'notSelected', order: notSelected.length + i, reason: x.reason }),
  );

  return {
    assignments,
    summary: {
      applicants: eligible.length + ineligible.length + blockedApplicants.length,
      eligible: eligible.length,
      cap,
      overCap: eligible.length > cap,
    },
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
