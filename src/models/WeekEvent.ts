import type { Assignment } from './Assignment';
import type { Attendance } from './Attendance';
import type { Registration } from './Registration';
import type { Settings } from './Settings';

/**
 * Lifecycle of a weekly Team A event:
 * registration -> planned (selection run) -> locked (plan published) -> finalised (attendance applied).
 */
export type EventStatus = 'registration' | 'planned' | 'locked' | 'finalised';

export interface WeekEvent {
  id: string;
  label: string;
  /** Event date, ISO yyyy-mm-dd. */
  date: string;
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
