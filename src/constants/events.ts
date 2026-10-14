import type { EventSlot } from '@/models/WeekEvent';

/** Both events are played on Fridays (ISO weekday 5), Paris time. */
export const EVENT_WEEKDAY = 5;
export const EVENT_TIME_ZONE = 'Europe/Paris';

/**
 * Players can sign up on the join page until Wednesday 10 PM (Paris time) before the Friday,
 * even after a leader ran the selection (the leaders re-run it to include late sign-ups).
 * private.join_open() in supabase/migrations/0003_join_open_until_wednesday.sql uses the same values.
 */
export const JOIN_DEADLINE_DAYS_BEFORE = 2;
export const JOIN_DEADLINE_TIME = '22:00';

export interface EventSlotInfo {
  team: string;
  /** Start time shown to leaders. */
  timeLabel: string;
  /** Start time on the public join page (12h and 24h, players are international). */
  joinTimeLabel: string;
  /** Start hour, Paris time (orders the two events of one day: Team B plays first). */
  startHour: number;
}

export const EVENT_SLOT_INFO: Readonly<Record<EventSlot, EventSlotInfo>> = Object.freeze({
  A: { team: 'Team A', timeLabel: '10 PM (Paris time)', joinTimeLabel: '10 PM (22h) Paris time', startHour: 22 },
  B: { team: 'Team B', timeLabel: '1 PM (Paris time)', joinTimeLabel: '1 PM (13h) Paris time', startHour: 13 },
});
