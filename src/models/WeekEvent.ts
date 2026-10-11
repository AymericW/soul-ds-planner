import type { Assignment } from './Assignment';
import type { Attendance } from './Attendance';
import type { Registration } from './Registration';
import type { Settings } from './Settings';

/**
 * Two independent Desert Storm events are played every Friday:
 * Team A (evening) and Team B (afternoon). A player may register for both
 * but can only play in one of them per week.
 */
export const EVENT_SLOTS = ['A', 'B'] as const;
export type EventSlot = (typeof EVENT_SLOTS)[number];

/**
 * Lifecycle of one weekly event (Team A or Team B):
 * registration -> planned (selection run) -> locked (plan published) -> finalised (attendance applied).
 */
export type EventStatus = 'registration' | 'planned' | 'locked' | 'finalised';

export interface WeekEvent {
  /** Deterministic: `${date}-${slot}`, e.g. "2026-10-16-A". */
  id: string;
  label: string;
  /** Event date (a Friday), ISO yyyy-mm-dd. */
  date: string;
  slot: EventSlot;
  status: EventStatus;
  registrations: Registration[];
  assignments: Assignment[];
  attendance: Attendance[];
  /** Ids of suspensions created when this event was finalised. */
  suspensionIdsIssued: string[];
  /** Rules used when the selection was run (for history display). */
  settingsSnapshot?: Settings;
  createdAt: string;
  updatedAt: string;
  finalisedAt?: string;
}
