/** localStorage keys for tiny UI preferences only (never business data). */
export const UI_STORAGE_KEYS = {
  rosterSort: 'soul-ds.roster-sort',
  /** Interface language chosen with the header switch (otherwise the browser language is used). */
  locale: 'soul-ds.locale',
} as const;

export const BACKUP_APP_ID = 'soul-ds-planner';
export const BACKUP_FORMAT_VERSION = 1;
