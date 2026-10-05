import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { DB_NAME, DB_VERSION, STORES } from '@/constants/storageKeys';
import type { Member } from '@/models/Member';
import type { Settings } from '@/models/Settings';
import type { Suspension } from '@/models/Suspension';
import type { WeekEvent } from '@/models/WeekEvent';

export interface SoulDsSchema extends DBSchema {
  members: { key: string; value: Member };
  events: { key: string; value: WeekEvent };
  suspensions: { key: string; value: Suspension };
  settings: { key: string; value: { key: string; value: Settings } };
}

export type SoulDsDatabase = IDBPDatabase<SoulDsSchema>;

export function openSoulDsDatabase(name = DB_NAME): Promise<SoulDsDatabase> {
  return openDB<SoulDsSchema>(name, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORES.members)) db.createObjectStore(STORES.members, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORES.events)) db.createObjectStore(STORES.events, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORES.suspensions)) db.createObjectStore(STORES.suspensions, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORES.settings)) db.createObjectStore(STORES.settings, { keyPath: 'key' });
    },
  });
}
