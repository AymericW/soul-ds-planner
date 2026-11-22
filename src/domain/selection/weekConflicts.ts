import { t } from '@/helpers/i18n';
import { isStarterSlot, type Slot } from '@/models/Assignment';
import type { WeekEvent } from '@/models/WeekEvent';

/**
 * One player, one game per week. Rules between Team A and Team B of the same week:
 *  - a player listed in one event (starter or substitute) cannot be listed in the other;
 *  - once a player actually entered one event, they are out of the other.
 */
export interface WeekCommitment {
  memberId: string;
  /** Team of the other event, e.g. "Team B". */
  team: string;
  kind: 'starter' | 'substitute' | 'entered';
}

/** What a member already has in the other event(s) of the week (strongest commitment wins). */
export function commitmentIn(otherEvents: readonly WeekEvent[], memberId: string): WeekCommitment | undefined {
  let best: WeekCommitment | undefined;
  const rank = { substitute: 1, starter: 2, entered: 3 } as const;
  for (const event of otherEvents) {
    const team = t().events.team(event.slot);
    const assignment = event.assignments.find((a) => a.memberId === memberId);
    const entered = Boolean(assignment && assignment.slot !== 'notSelected' && event.attendance.some((a) => a.memberId === memberId && a.attended));
    let kind: WeekCommitment['kind'] | undefined;
    if (entered) kind = 'entered';
    else if (assignment && isStarterSlot(assignment.slot)) kind = 'starter';
    else if (assignment?.slot === 'substitute') kind = 'substitute';
    if (kind && (!best || rank[kind] > rank[best.kind])) best = { memberId, team, kind };
  }
  return best;
}

export function commitmentReason(c: WeekCommitment): string {
  if (c.kind === 'entered') return t().rules.alreadyPlayedIn(c.team);
  if (c.kind === 'starter') return t().rules.starterIn(c.team);
  return t().rules.substituteIn(c.team);
}

/**
 * Why a member cannot be put in `slot` of this event given the other event(s) of the week,
 * or null when the placement is allowed. Used for manual moves, swaps and late additions.
 */
export function placementConflict(memberId: string, slot: Slot, otherEvents: readonly WeekEvent[]): string | null {
  if (slot === 'notSelected') return null;
  const c = commitmentIn(otherEvents, memberId);
  if (!c) return null;
  if (c.kind === 'entered') return t().rules.onePerWeek(commitmentReason(c));
  if (c.kind === 'starter') return t().rules.starterElsewhere(commitmentReason(c));
  return t().rules.substituteElsewhere(commitmentReason(c));
}

/** Why attendance cannot be recorded for this member (entered the other event already), or null. */
export function attendanceConflict(memberId: string, otherEvents: readonly WeekEvent[]): string | null {
  const c = commitmentIn(otherEvents, memberId);
  return c?.kind === 'entered' ? t().rules.onePerWeek(commitmentReason(c)) : null;
}
