import type { Member } from '@/models/Member';
import type { Settings } from '@/models/Settings';
import type { Suspension } from '@/models/Suspension';
import type { WeekEvent } from '@/models/WeekEvent';
import type { Repositories } from '../repositories';
import { mergeWithDefaultSettings } from '../settingsMerge';

const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/**
 * Non-persistent implementation of the same contracts. Used by tests and as
 * the fallback when IndexedDB is unavailable (e.g. some private browsing modes).
 */
export function createInMemoryRepositories(): Repositories {
  const members = new Map<string, Member>();
  const events = new Map<string, WeekEvent>();
  const suspensions = new Map<string, Suspension>();
  let settings: Settings | undefined;

  return {
    members: {
      list: async () => [...members.values()].map(copy),
      get: async (id) => (members.has(id) ? copy(members.get(id)!) : undefined),
      save: async (m) => void members.set(m.id, copy(m)),
      saveMany: async (list) => list.forEach((m) => members.set(m.id, copy(m))),
      delete: async (id) => void members.delete(id),
      replaceAll: async (list) => {
        members.clear();
        list.forEach((m) => members.set(m.id, copy(m)));
      },
    },
    events: {
      list: async () => [...events.values()].map(copy),
      get: async (id) => (events.has(id) ? copy(events.get(id)!) : undefined),
      save: async (e) => void events.set(e.id, copy(e)),
      delete: async (id) => void events.delete(id),
      replaceAll: async (list) => {
        events.clear();
        list.forEach((e) => events.set(e.id, copy(e)));
      },
    },
    suspensions: {
      list: async () => [...suspensions.values()].map(copy),
      saveMany: async (list) => list.forEach((s) => suspensions.set(s.id, copy(s))),
      replaceAll: async (list) => {
        suspensions.clear();
        list.forEach((s) => suspensions.set(s.id, copy(s)));
      },
    },
    settings: {
      get: async () => mergeWithDefaultSettings(settings),
      save: async (s) => {
        settings = copy(s);
      },
    },
    async clearAll() {
      members.clear();
      events.clear();
      suspensions.clear();
      settings = undefined;
    },
  };
}
