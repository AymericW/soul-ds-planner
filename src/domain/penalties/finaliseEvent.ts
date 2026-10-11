import { pluralise } from '@/helpers/format';
import type { Attendance } from '@/models/Attendance';
import type { Settings } from '@/models/Settings';
import type { Suspension } from '@/models/Suspension';
import type { WeekEvent } from '@/models/WeekEvent';
import { membersToPenalise } from './penaltyRules';
import { countDownSuspensions } from './suspensions';

export interface FinaliseInput {
  event: WeekEvent;
  attendance: readonly Attendance[];
  suspensions: readonly Suspension[];
  settings: Settings;
  nowIso: string;
  newId: () => string;
  /**
   * The other event(s) of the same week. Suspensions count down once per WEEK: only when the
   * first event of a week is finalised (none of these is finalised yet).
   */
  sameWeekEvents?: readonly WeekEvent[];
}

export interface FinaliseResult {
  event: WeekEvent;
  /** Every suspension after this event (existing ones counted down + new ones). */
  suspensions: Suspension[];
  issued: Suspension[];
}

export class FinaliseError extends Error {}

/**
 * Closes one event (Team A or Team B):
 * 1. keeps one attendance record per lineup player (core, rotation, substitutes);
 * 2. when this is the first event of its week to be finalised, counts down every suspension
 *    that existed BEFORE it by one week (the second event of the week does not count again);
 * 3. suspends each starter of THIS event who did not attend and did not notify for
 *    `settings.suspensionEvents` upcoming weeks.
 */
export function finaliseEvent(input: FinaliseInput): FinaliseResult {
  const { event, settings, nowIso, newId } = input;
  if (event.status === 'finalised') throw new FinaliseError('This event is already finalised.');
  if (event.status === 'registration') throw new FinaliseError('Run the selection before finalising.');

  const given = new Map(input.attendance.map((a) => [a.memberId, a]));
  const attendance: Attendance[] = event.assignments
    .filter((a) => a.slot !== 'notSelected')
    .map((a) => {
      const record = given.get(a.memberId);
      const attended = record?.attended ?? false;
      return { memberId: a.memberId, attended, notified: attended ? false : (record?.notified ?? false) };
    });

  const firstOfWeek = !(input.sameWeekEvents ?? []).some((e) => e.id !== event.id && e.status === 'finalised');
  const countedDown = firstOfWeek ? countDownSuspensions(input.suspensions) : [...input.suspensions];
  const total = Math.max(0, Math.floor(settings.suspensionEvents));
  const issued: Suspension[] =
    total === 0
      ? []
      : membersToPenalise(event, attendance).map((memberId) => ({
          id: newId(),
          memberId,
          sourceEventId: event.id,
          createdAt: nowIso,
          totalEvents: total,
          remainingEvents: total,
          reason: `No-show without notice at ${event.label} – suspended for ${pluralise(total, 'week')}.`,
        }));

  return {
    event: {
      ...event,
      status: 'finalised',
      attendance,
      suspensionIdsIssued: issued.map((s) => s.id),
      finalisedAt: nowIso,
      updatedAt: nowIso,
    },
    suspensions: [...countedDown, ...issued],
    issued,
  };
}
