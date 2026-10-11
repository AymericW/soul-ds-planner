import { weekStart } from '@/helpers/dates';
import type { WeekEvent } from '@/models/WeekEvent';
import { didPlay, didRegister, finalisedEventsChronological } from './eventHistory';

/**
 * History is counted in WEEKS: Team A and Team B of the same Friday form one week.
 * A week in which a member played in A or B is one played week (never two), and
 * registering for A, B or both is one registered week.
 */
export interface WeekRecord {
  /** Monday of the week (yyyy-mm-dd). */
  key: string;
  /** Finalised events of that week, oldest first. */
  events: WeekEvent[];
}

/** Weeks with at least one finalised event, oldest first. Non-finalised events are ignored. */
export function finalisedWeeks(events: readonly WeekEvent[]): WeekRecord[] {
  const byKey = new Map<string, WeekEvent[]>();
  for (const event of finalisedEventsChronological(events)) {
    const key = weekStart(event.date);
    byKey.set(key, [...(byKey.get(key) ?? []), event]);
  }
  return [...byKey.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, list]) => ({ key, events: list }));
}

/** Only the weeks strictly before `weekKey` (the week being planned never counts as its own history). */
export function weeksBefore(weeks: readonly WeekRecord[], weekKey: string): WeekRecord[] {
  return weeks.filter((w) => w.key < weekKey);
}

export function playedInWeek(week: WeekRecord, memberId: string): boolean {
  return week.events.some((e) => didPlay(e, memberId));
}

export function registeredInWeek(week: WeekRecord, memberId: string): boolean {
  return week.events.some((e) => didRegister(e, memberId));
}

/**
 * Number of finalised weeks since the member last played:
 * 0 = played in the most recent finalised week, null = never played.
 */
export function weeksSinceLastPlayed(weeks: readonly WeekRecord[], memberId: string): number | null {
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (playedInWeek(weeks[i]!, memberId)) return weeks.length - 1 - i;
  }
  return null;
}

export function playedLastWeek(weeks: readonly WeekRecord[], memberId: string): boolean {
  const last = weeks[weeks.length - 1];
  return last ? playedInWeek(last, memberId) : false;
}
