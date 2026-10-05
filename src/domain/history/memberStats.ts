import type { Member } from '@/models/Member';
import type { MemberStats } from '@/models/MemberStats';
import type { Suspension } from '@/models/Suspension';
import type { WeekEvent } from '@/models/WeekEvent';
import { remainingSuspension } from '@/domain/penalties/suspensions';
import { didPlay, didRegister, eventsSinceLastPlayed, finalisedEventsChronological } from './eventHistory';

/**
 * Participation rate = times played / finalised events the member registered for.
 * (Registering and not being picked lowers the rate, which is exactly what the
 * rotation tries to correct.)
 */
export function computeMemberStats(
  member: Member,
  events: readonly WeekEvent[],
  suspensions: readonly Suspension[],
): MemberStats {
  const chronological = finalisedEventsChronological(events);
  let eventsRegistered = 0;
  let timesPlayed = 0;
  for (const event of chronological) {
    if (didRegister(event, member.id)) eventsRegistered++;
    if (didPlay(event, member.id)) timesPlayed++;
  }
  return {
    memberId: member.id,
    eventsRegistered,
    timesPlayed,
    participationRate: eventsRegistered > 0 ? Math.min(1, timesPlayed / eventsRegistered) : null,
    eventsSinceLastPlayed: eventsSinceLastPlayed(chronological, member.id),
    suspensionRemaining: remainingSuspension(member.id, suspensions),
  };
}

export function computeRosterStats(
  members: readonly Member[],
  events: readonly WeekEvent[],
  suspensions: readonly Suspension[],
): Map<string, MemberStats> {
  return new Map(members.map((m) => [m.id, computeMemberStats(m, events, suspensions)]));
}
