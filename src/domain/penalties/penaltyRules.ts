import { isStarterSlot, type Slot } from '@/models/Assignment';
import type { Attendance } from '@/models/Attendance';
import type { WeekEvent } from '@/models/WeekEvent';

/**
 * The no-show rule:
 *   starter (core or rotation) + did not attend + did not notify  => penalised.
 * Substitutes are NEVER penalised (even if called and absent). A notification,
 * even a late one, always avoids the penalty. R4 members follow the same rule.
 */
export function isPenalised(slot: Slot, attendance: Attendance | undefined): boolean {
  if (!isStarterSlot(slot)) return false;
  if (attendance?.attended) return false;
  if (attendance?.notified) return false;
  return true;
}

/** Whether the "notified an R4 / substitute?" question applies to this player. */
export function needsNotificationAnswer(slot: Slot, attendance: Attendance | undefined): boolean {
  return isStarterSlot(slot) && !attendance?.attended;
}

/** Member ids that would be suspended if the event were finalised with this attendance. */
export function membersToPenalise(event: Pick<WeekEvent, 'assignments'>, attendance: readonly Attendance[]): string[] {
  const byMember = new Map(attendance.map((a) => [a.memberId, a]));
  return event.assignments.filter((a) => isPenalised(a.slot, byMember.get(a.memberId))).map((a) => a.memberId);
}
