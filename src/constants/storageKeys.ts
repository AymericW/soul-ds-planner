/** IndexedDB database + object store names. Bump DB_VERSION when adding stores/indexes. */
export const DB_NAME = 'soul-ds-planner';
export const DB_VERSION = 1;

export const STORES = {
  members: 'members',
  events: 'events',
  suspensions: 'suspensions',
  settings: 'settings',
} as const;

export const SETTINGS_RECORD_KEY = 'app-settings';

/** localStorage keys for tiny UI preferences only (never business data). */
export const UI_STORAGE_KEYS = {
  rosterSort: 'soul-ds.roster-sort',
} as const;

export const BACKUP_APP_ID = 'soul-ds-planner';
export const BACKUP_FORMAT_VERSION = 1;
