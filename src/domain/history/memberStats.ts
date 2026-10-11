import type { Member } from '@/models/Member';
import type { MemberStats } from '@/models/MemberStats';
import type { Suspension } from '@/models/Suspension';
import type { WeekEvent } from '@/models/WeekEvent';
import { remainingSuspension } from '@/domain/penalties/suspensions';
import { finalisedWeeks, playedInWeek, registeredInWeek, weeksSinceLastPlayed, type WeekRecord } from './weekHistory';

/**
 * Participation rate = weeks played / weeks registered (Team A and Team B combined).
 * A week where the member registered for both events and played one of them is a
 * played week (rate 1/1), not a no-show: a player can only play once per week.
 * Registering and not being picked lowers the rate, which is exactly what the
 * rotation tries to correct.
 */
export function computeMemberStats(
  member: Member,
  events: readonly WeekEvent[],
  suspensions: readonly Suspension[],
  weeks: readonly WeekRecord[] = finalisedWeeks(events),
): MemberStats {
  let weeksRegistered = 0;
  let weeksPlayed = 0;
  for (const week of weeks) {
    const played = playedInWeek(week, member.id);
    // Playing implies taking part, even if the registration was removed afterwards.
    if (played || registeredInWeek(week, member.id)) weeksRegistered++;
    if (played) weeksPlayed++;
  }
  return {
    memberId: member.id,
    weeksRegistered,
    weeksPlayed,
    participationRate: weeksRegistered > 0 ? weeksPlayed / weeksRegistered : null,
    weeksSinceLastPlayed: weeksSinceLastPlayed(weeks, member.id),
    suspensionRemaining: remainingSuspension(member.id, suspensions),
  };
}

export function computeRosterStats(
  members: readonly Member[],
  events: readonly WeekEvent[],
  suspensions: readonly Suspension[],
): Map<string, MemberStats> {
  const weeks = finalisedWeeks(events);
  return new Map(members.map((m) => [m.id, computeMemberStats(m, events, suspensions, weeks)]));
}
