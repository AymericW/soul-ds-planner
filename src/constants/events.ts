import type { EventSlot } from '@/models/WeekEvent';

/** Both events are played on Fridays (ISO weekday 5), Paris time. */
export const EVENT_WEEKDAY = 5;
export const EVENT_TIME_ZONE = 'Europe/Paris';

export interface EventSlotInfo {
  team: string;
  /** Start time shown to players. */
  timeLabel: string;
  /** Start hour, Paris time (orders the two events of one day: Team B plays first). */
  startHour: number;
}

export const EVENT_SLOT_INFO: Readonly<Record<EventSlot, EventSlotInfo>> = Object.freeze({
  A: { team: 'Team A', timeLabel: '10 PM (Paris time)', startHour: 22 },
  B: { team: 'Team B', timeLabel: '1 PM (Paris time)', startHour: 13 },
});
