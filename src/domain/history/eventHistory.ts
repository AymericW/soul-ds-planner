import { EVENT_SLOT_INFO } from '@/constants/events';
import type { Slot } from '@/models/Assignment';
import type { WeekEvent } from '@/models/WeekEvent';

/** Chronological order: date, then start time (Team B plays before Team A), then creation time. */
export function compareEventsChronologically(a: WeekEvent, b: WeekEvent): number {
  return (
    a.date.localeCompare(b.date) ||
    (EVENT_SLOT_INFO[a.slot]?.startHour ?? 0) - (EVENT_SLOT_INFO[b.slot]?.startHour ?? 0) ||
    a.createdAt.localeCompare(b.createdAt) ||
    a.id.localeCompare(b.id)
  );
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
