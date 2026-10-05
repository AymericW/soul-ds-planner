import type { Suspension } from '@/models/Suspension';

export function isSuspensionActive(s: Suspension): boolean {
  return !s.liftedAt && s.remainingEvents > 0;
}

/** Events the member is still suspended for (max over active suspensions; 0 = free). */
export function remainingSuspension(memberId: string, suspensions: readonly Suspension[]): number {
  return suspensions
    .filter((s) => s.memberId === memberId && isSuspensionActive(s))
    .reduce((max, s) => Math.max(max, s.remainingEvents), 0);
}

export function isSuspended(memberId: string, suspensions: readonly Suspension[]): boolean {
  return remainingSuspension(memberId, suspensions) > 0;
}

/**
 * Called once per finalised Team A event, BEFORE new penalties of that event are
 * created: every active suspension loses one event.
 */
export function countDownSuspensions(suspensions: readonly Suspension[]): Suspension[] {
  return suspensions.map((s) => (isSuspensionActive(s) ? { ...s, remainingEvents: s.remainingEvents - 1 } : s));
}

/** R4 lifts every active suspension of a member early. */
export function liftSuspensions(memberId: string, suspensions: readonly Suspension[], nowIso: string): Suspension[] {
  return suspensions.map((s) =>
    s.memberId === memberId && isSuspensionActive(s) ? { ...s, liftedAt: nowIso } : s,
  );
}
