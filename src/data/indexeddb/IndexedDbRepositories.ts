import { SETTINGS_RECORD_KEY, STORES } from '@/constants/storageKeys';
import type { Member } from '@/models/Member';
import type { Settings } from '@/models/Settings';
import type { Suspension } from '@/models/Suspension';
import type { WeekEvent } from '@/models/WeekEvent';
import type {
  EventRepository,
  MemberRepository,
  Repositories,
  SettingsRepository,
  SuspensionRepository,
} from '../repositories';
import { mergeWithDefaultSettings } from '../settingsMerge';
import type { SoulDsDatabase } from './database';

type EntityStore = typeof STORES.members | typeof STORES.events | typeof STORES.suspensions;

/** Writes many records in one transaction (optionally clearing the store first). */
async function putAll<T>(db: SoulDsDatabase, store: EntityStore, items: readonly T[], clearFirst: boolean) {
  const tx = db.transaction(store, 'readwrite');
  const ops: Promise<unknown>[] = [];
  if (clearFirst) ops.push(tx.store.clear());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const item of items) ops.push(tx.store.put(item as any));
  ops.push(tx.done);
  await Promise.all(ops);
}

/** Structured clone strips React/proxy artefacts and guarantees plain data in storage. */
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

class IndexedDbMemberRepository implements MemberRepository {
  constructor(private readonly db: SoulDsDatabase) {}
  list() {
    return this.db.getAll(STORES.members);
  }
  get(id: string) {
    return this.db.get(STORES.members, id);
  }
  async save(member: Member) {
    await this.db.put(STORES.members, plain(member));
  }
  saveMany(members: readonly Member[]) {
    return putAll(this.db, STORES.members, plain(members), false);
  }
  delete(id: string) {
    return this.db.delete(STORES.members, id);
  }
  replaceAll(members: readonly Member[]) {
    return putAll(this.db, STORES.members, plain(members), true);
  }
}

class IndexedDbEventRepository implements EventRepository {
  constructor(private readonly db: SoulDsDatabase) {}
  list() {
    return this.db.getAll(STORES.events);
  }
  get(id: string) {
    return this.db.get(STORES.events, id);
  }
  async save(event: WeekEvent) {
    await this.db.put(STORES.events, plain(event));
  }
  delete(id: string) {
    return this.db.delete(STORES.events, id);
  }
  replaceAll(events: readonly WeekEvent[]) {
    return putAll(this.db, STORES.events, plain(events), true);
  }
}

class IndexedDbSuspensionRepository implements SuspensionRepository {
  constructor(private readonly db: SoulDsDatabase) {}
  list() {
    return this.db.getAll(STORES.suspensions);
  }
  saveMany(suspensions: readonly Suspension[]) {
    return putAll(this.db, STORES.suspensions, plain(suspensions), false);
  }
  replaceAll(suspensions: readonly Suspension[]) {
    return putAll(this.db, STORES.suspensions, plain(suspensions), true);
  }
}

class IndexedDbSettingsRepository implements SettingsRepository {
  constructor(private readonly db: SoulDsDatabase) {}
  async get() {
    const record = await this.db.get(STORES.settings, SETTINGS_RECORD_KEY);
    return mergeWithDefaultSettings(record?.value);
  }
  async save(settings: Settings) {
    await this.db.put(STORES.settings, { key: SETTINGS_RECORD_KEY, value: plain(settings) });
  }
}

export function createIndexedDbRepositories(db: SoulDsDatabase): Repositories {
  return {
    members: new IndexedDbMemberRepository(db),
    events: new IndexedDbEventRepository(db),
    suspensions: new IndexedDbSuspensionRepository(db),
    settings: new IndexedDbSettingsRepository(db),
    async clearAll() {
      await Promise.all([
        db.clear(STORES.members),
        db.clear(STORES.events),
        db.clear(STORES.suspensions),
        db.clear(STORES.settings),
      ]);
    },
  };
}
