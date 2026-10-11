import { EVENT_SLOT_INFO, EVENT_TIME_ZONE, EVENT_WEEKDAY } from '@/constants/events';
import { dateInTimeZone, defaultEventLabel, nextWeekdayOnOrAfter, weekStart } from '@/helpers/dates';
import { EVENT_SLOTS, type EventSlot, type WeekEvent } from '@/models/WeekEvent';
import { compareEventsChronologically } from '@/domain/history/eventHistory';

/** The events of one week, by slot. */
export type WeekEvents = Partial<Record<EventSlot, WeekEvent>>;

/**
 * Friday the events are created for: today when today (Paris time) is a Friday,
 * otherwise the next Friday. ensure_week_events() in the database uses the same rule.
 */
export function upcomingEventDate(now: Date): string {
  return nextWeekdayOnOrAfter(dateInTimeZone(now, EVENT_TIME_ZONE), EVENT_WEEKDAY);
}

export function weekEventId(date: string, slot: EventSlot): string {
  return `${date}-${slot}`;
}

export function createWeekEvent(date: string, slot: EventSlot, nowIso: string): WeekEvent {
  return {
    id: weekEventId(date, slot),
    label: defaultEventLabel(date, EVENT_SLOT_INFO[slot].team),
    date,
    slot,
    status: 'registration',
    registrations: [],
    assignments: [],
    attendance: [],
    suspensionIdsIssued: [],
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

/** The Team A / Team B events of `date` that do not exist yet (idempotent "ensure"). */
export function missingWeekEvents(events: readonly WeekEvent[], date: string, nowIso: string): WeekEvent[] {
  const ids = new Set(events.map((e) => e.id));
  return EVENT_SLOTS.filter((slot) => !ids.has(weekEventId(date, slot))).map((slot) => createWeekEvent(date, slot, nowIso));
}

/** Identifies the week of an event (Monday of its week), so A and B of one Friday share it. */
export function weekKeyOf(event: Pick<WeekEvent, 'date'>): string {
  return weekStart(event.date);
}

export function weekEventsByKey(events: readonly WeekEvent[], key: string): WeekEvents {
  const result: WeekEvents = {};
  for (const e of [...events].sort(compareEventsChronologically)) {
    if (weekKeyOf(e) === key) result[e.slot] = e;
  }
  return result;
}

/** The other event(s) of the same week as `event`. */
export function otherEventsOfWeek(events: readonly WeekEvent[], event: Pick<WeekEvent, 'id' | 'date'>): WeekEvent[] {
  const key = weekKeyOf(event);
  return events.filter((e) => e.id !== event.id && weekKeyOf(e) === key);
}

/** Weeks that still have an event to prepare or finalise, oldest first. */
export function openWeekKeys(events: readonly WeekEvent[]): string[] {
  return [...new Set(events.filter((e) => e.status !== 'finalised').map(weekKeyOf))].sort();
}

/** Most recent week in which every event is finalised (for the "last week" summary). */
export function lastFinalisedWeekKey(events: readonly WeekEvent[]): string | undefined {
  const open = new Set(openWeekKeys(events));
  return [...new Set(events.filter((e) => e.status === 'finalised').map(weekKeyOf))]
    .filter((k) => !open.has(k))
    .sort()
    .pop();
}
