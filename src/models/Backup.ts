import type { Member } from './Member';
import type { Settings } from './Settings';
import type { Suspension } from './Suspension';
import type { WeekEvent } from './WeekEvent';

export interface BackupFile {
  app: 'soul-ds-planner';
  formatVersion: 1;
  exportedAt: string;
  members: Member[];
  events: WeekEvent[];
  suspensions: Suspension[];
  settings: Settings;
}
