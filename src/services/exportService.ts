import { BACKUP_APP_ID, BACKUP_FORMAT_VERSION } from '@/constants/storageKeys';
import { toCsv } from '@/helpers/csv';
import { formatPercent } from '@/helpers/format';
import type { BackupFile } from '@/models/Backup';
import type { Member } from '@/models/Member';
import type { MemberStats } from '@/models/MemberStats';
import type { Settings } from '@/models/Settings';
import type { Suspension } from '@/models/Suspension';
import type { WeekEvent } from '@/models/WeekEvent';

export class InvalidBackupError extends Error {}

export interface BackupContents {
  members: Member[];
  events: WeekEvent[];
  suspensions: Suspension[];
  settings: Settings;
}

export function buildBackup(contents: BackupContents, nowIso: string): BackupFile {
  return { app: BACKUP_APP_ID, formatVersion: BACKUP_FORMAT_VERSION, exportedAt: nowIso, ...contents };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Parses and sanity-checks a backup file before anything is overwritten. */
export function parseBackup(text: string): BackupFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new InvalidBackupError('This file is not valid JSON.');
  }
  if (!isObject(data) || data.app !== BACKUP_APP_ID) {
    throw new InvalidBackupError('This is not a SOUL DS backup file.');
  }
  if (typeof data.formatVersion !== 'number' || data.formatVersion > BACKUP_FORMAT_VERSION) {
    throw new InvalidBackupError('This backup was made by a newer version of the app.');
  }
  for (const key of ['members', 'events', 'suspensions'] as const) {
    if (!Array.isArray(data[key])) throw new InvalidBackupError(`Backup is missing "${key}".`);
  }
  const members = data.members as unknown[];
  if (!members.every((m) => isObject(m) && typeof m.id === 'string' && typeof m.name === 'string')) {
    throw new InvalidBackupError('Backup contains invalid members.');
  }
  const events = data.events as unknown[];
  if (!events.every((e) => isObject(e) && typeof e.id === 'string' && Array.isArray(e.assignments))) {
    throw new InvalidBackupError('Backup contains invalid events.');
  }
  return {
    ...(data as unknown as BackupFile),
    members: (data.members as Member[]).map((m) => ({ ...m, aliases: Array.isArray(m.aliases) ? m.aliases : [] })),
  };
}

export function rosterToCsv(members: readonly Member[], stats: ReadonlyMap<string, MemberStats>): string {
  const header = ['Name', 'Power', 'Activity', 'Rank', 'Active', 'Participation', 'Times played', 'Events since last played', 'Suspended (events left)'];
  const rows = members.map((m) => {
    const s = stats.get(m.id);
    return [
      m.name,
      m.power,
      m.activity,
      m.rank ?? '',
      m.active ? 'yes' : 'no',
      formatPercent(s?.participationRate ?? null),
      s?.timesPlayed ?? 0,
      s?.eventsSinceLastPlayed ?? 'never',
      s?.suspensionRemaining ?? 0,
    ];
  });
  return toCsv([header, ...rows]);
}

/** Triggers a browser download (no server involved). */
export function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
