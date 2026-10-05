import type { Slot } from '@/models/Assignment';
import type { WeekEvent } from '@/models/WeekEvent';

/** Chronological order: date, then creation time (stable for several events on one day). */
export function compareEventsChronologically(a: WeekEvent, b: WeekEvent): number {
  return a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

/** Finalised events, oldest first. Only these count for history, priority and stats. */
export function finalisedEventsChronological(events: readonly WeekEvent[]): WeekEvent[] {
  return events.filter((e) => e.status === 'finalised').sort(compareEventsChronologically);
}

export function slotOf(event: WeekEvent, memberId: string): Slot | undefined {
  return event.assignments.find((a) => a.memberId === memberId)?.slot;
}

/**
 * "Played" = was in the lineup (core, rotation or substitute) AND attended.
 * A substitute who was called in and entered counts; an unused substitute does not.
 */
export function didPlay(event: WeekEvent, memberId: string): boolean {
  const slot = slotOf(event, memberId);
  if (!slot || slot === 'notSelected') return false;
  return event.attendance.some((a) => a.memberId === memberId && a.attended);
}

export function didRegister(event: WeekEvent, memberId: string): boolean {
  return event.registrations.some((r) => r.memberId === memberId);
}

/**
 * Number of finalised events since the member last played:
 * 0 = played in the most recent finalised event, null = never played.
 * `chronological` must be finalised events, oldest first.
 */
export function eventsSinceLastPlayed(chronological: readonly WeekEvent[], memberId: string): number | null {
  for (let i = chronological.length - 1; i >= 0; i--) {
    if (didPlay(chronological[i]!, memberId)) return chronological.length - 1 - i;
  }
  return null;
}

export function playedLastEvent(chronological: readonly WeekEvent[], memberId: string): boolean {
  const last = chronological[chronological.length - 1];
  return last ? didPlay(last, memberId) : false;
}
