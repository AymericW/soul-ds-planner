import type { SupabaseClient } from '@supabase/supabase-js';
import type { Member } from '@/models/Member';
import type { Settings } from '@/models/Settings';
import type { Suspension } from '@/models/Suspension';
import type { WeekEvent } from '@/models/WeekEvent';
import { ConflictError, type Repositories } from '../repositories';
import { mergeWithDefaultSettings } from '../settingsMerge';

interface Row<T> {
  id: string;
  data: T;
}

interface EventRow extends Row<WeekEvent> {
  version: number;
}

/** Postgres serialization failure raised by save_event / finalise_event when the version moved on. */
const CONFLICT_CODE = '40001';
const SETTINGS_ID = 'app';
/** PostgREST returns at most 1000 rows by default; far above one alliance's roster/history. */
const MAX_ROWS = 1000;

interface BackendError {
  code?: string;
  message: string;
}

function raise(error: BackendError | null): void {
  if (!error) return;
  if (error.code === CONFLICT_CODE) throw new ConflictError();
  throw new Error(error.message);
}

/** Plain JSON, free of proxies/undefined values, as the database stores it. */
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

type DocTable = 'members' | 'suspensions';

function documentTable<T extends { id: string }>(client: SupabaseClient, table: DocTable) {
  return {
    async list(): Promise<T[]> {
      const { data, error } = await client.from(table).select('id, data').limit(MAX_ROWS);
      raise(error);
      return ((data ?? []) as Row<T>[]).map((r) => r.data);
    },
    async get(id: string): Promise<T | undefined> {
      const { data, error } = await client.from(table).select('id, data').eq('id', id).maybeSingle();
      raise(error);
      return (data as Row<T> | null)?.data;
    },
    async saveMany(items: readonly T[]): Promise<void> {
      if (items.length === 0) return;
      const { error } = await client.from(table).upsert(items.map((item) => ({ id: item.id, data: plain(item) })));
      raise(error);
    },
    async delete(id: string): Promise<void> {
      const { error } = await client.from(table).delete().eq('id', id);
      raise(error);
    },
    async clear(): Promise<void> {
      const { error } = await client.from(table).delete().neq('id', '');
      raise(error);
    },
  };
}

export function createSupabaseRepositories(client: SupabaseClient): Repositories {
  const memberDocs = documentTable<Member>(client, 'members');
  const suspensionDocs = documentTable<Suspension>(client, 'suspensions');

  /** Version of each event as last read; sent back on save so concurrent edits are detected. */
  const versions = new Map<string, number>();

  const clearEvents = async () => {
    const { error } = await client.from('events').delete().neq('id', '');
    raise(error);
    versions.clear();
  };

  const events: Repositories['events'] = {
    async list() {
      const { data, error } = await client.from('events').select('id, data, version').limit(MAX_ROWS);
      raise(error);
      return ((data ?? []) as EventRow[]).map((r) => {
        versions.set(r.id, r.version);
        return r.data;
      });
    },
    async get(id) {
      const { data, error } = await client.from('events').select('id, data, version').eq('id', id).maybeSingle();
      raise(error);
      const row = data as EventRow | null;
      if (!row) return undefined;
      versions.set(row.id, row.version);
      return row.data;
    },
    async save(event) {
      const { data, error } = await client.rpc('save_event', {
        p_id: event.id,
        p_data: plain(event),
        p_expected: versions.get(event.id) ?? null,
      });
      raise(error);
      versions.set(event.id, data as number);
    },
    async delete(id) {
      const { error } = await client.from('events').delete().eq('id', id);
      raise(error);
      versions.delete(id);
    },
    async replaceAll(list) {
      await clearEvents();
      if (list.length === 0) return;
      const { error } = await client.from('events').insert(list.map((e) => ({ id: e.id, data: plain(e) })));
      raise(error);
    },
  };

  return {
    members: {
      list: memberDocs.list,
      get: memberDocs.get,
      save: (member) => memberDocs.saveMany([member]),
      saveMany: memberDocs.saveMany,
      delete: memberDocs.delete,
      async replaceAll(list) {
        await memberDocs.clear();
        await memberDocs.saveMany(list);
      },
    },
    events,
    suspensions: {
      list: suspensionDocs.list,
      saveMany: suspensionDocs.saveMany,
      async replaceAll(list) {
        await suspensionDocs.clear();
        await suspensionDocs.saveMany(list);
      },
    },
    settings: {
      async get() {
        const { data, error } = await client.from('settings').select('id, data').eq('id', SETTINGS_ID).maybeSingle();
        raise(error);
        return mergeWithDefaultSettings((data as Row<Partial<Settings>> | null)?.data);
      },
      async save(settings) {
        const { error } = await client.from('settings').upsert({ id: SETTINGS_ID, data: plain(settings) });
        raise(error);
      },
    },
    async finaliseEvent(event, suspensions) {
      const { data, error } = await client.rpc('finalise_event', {
        p_id: event.id,
        p_event: plain(event),
        p_expected: versions.get(event.id) ?? null,
        p_suspensions: plain(suspensions),
      });
      raise(error);
      versions.set(event.id, data as number);
    },
    subscribe(listener) {
      const channel = client
        .channel(`alliance-${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: '*', schema: 'public' }, () => listener())
        .subscribe();
      return () => void client.removeChannel(channel);
    },
    async clearAll() {
      await Promise.all([memberDocs.clear(), suspensionDocs.clear(), clearEvents()]);
      const { error } = await client.from('settings').delete().eq('id', SETTINGS_ID);
      raise(error);
    },
  };
}
