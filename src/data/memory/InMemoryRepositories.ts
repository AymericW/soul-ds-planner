import { missingWeekEvents, upcomingEventDate } from '@/domain/events/weekEvents';
import { createId } from '@/helpers/id';
import type { JoinRequest } from '@/models/JoinRequest';
import type { Member } from '@/models/Member';
import type { PowerChange } from '@/models/PowerChange';
import type { Settings } from '@/models/Settings';
import type { Suspension } from '@/models/Suspension';
import type { WeekEvent } from '@/models/WeekEvent';
import { ConflictError, type Repositories } from '../repositories';
import { mergeWithDefaultSettings } from '../settingsMerge';
import { createInMemoryJoinGateway, type InMemoryStore } from './inMemoryJoin';

const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export interface InMemoryOptions {
  now?: () => Date;
  newId?: () => string;
}

const sameSuspensions = (a: readonly Suspension[], b: readonly Suspension[]) => {
  const sorted = (list: readonly Suspension[]) => JSON.stringify([...list].sort((x, y) => x.id.localeCompare(y.id)));
  return sorted(a) === sorted(b);
};

/**
 * Non-persistent implementation of the same contracts, used by tests and local development.
 * The join gateway mirrors the database functions of supabase/migrations/0002 (code check,
 * bounds, idempotent resubmit, closed registrations, unlisted requests, rate limits).
 */
export function createInMemoryRepositories(options: InMemoryOptions = {}): Repositories {
  const now = options.now ?? (() => new Date());
  const newId = options.newId ?? createId;
  const store: InMemoryStore = {
    members: new Map<string, Member>(),
    events: new Map<string, WeekEvent>(),
    suspensions: new Map<string, Suspension>(),
    joinRequests: new Map<string, JoinRequest>(),
    powerChanges: new Map<string, PowerChange>(),
    settings: undefined as Settings | undefined,
    attempts: [],
  };
  const { members, events, suspensions, joinRequests, powerChanges } = store;

  const ensureWeekEvents = async () => {
    for (const e of missingWeekEvents([...events.values()], upcomingEventDate(now()), now().toISOString())) events.set(e.id, e);
  };

  const repos: Repositories = {
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
      ensureWeekEvents,
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
      get: async () => mergeWithDefaultSettings(store.settings),
      // Like the database trigger: a plain save never touches the join code.
      save: async (s) => {
        store.settings = { ...copy(s), joinCode: store.settings?.joinCode ?? '' };
      },
      setJoinCode: async (code) => {
        store.settings = { ...mergeWithDefaultSettings(store.settings), joinCode: code };
      },
    },
    joinRequests: {
      list: async () => [...joinRequests.values()].map(copy),
      save: async (r) => void joinRequests.set(r.id, copy(r)),
    },
    powerChanges: {
      list: async () => [...powerChanges.values()].map(copy),
      saveMany: async (list) => list.forEach((c) => powerChanges.set(c.id, copy(c))),
    },
    join: createInMemoryJoinGateway(store, { now, newId, ensureWeekEvents }),
    async finaliseEvent(event, list, basedOn) {
      if (!sameSuspensions([...suspensions.values()], basedOn)) throw new ConflictError('Suspensions changed meanwhile (the other event of the week was finalised?).');
      events.set(event.id, copy(event));
      suspensions.clear();
      list.forEach((s) => suspensions.set(s.id, copy(s)));
    },
    subscribe: () => () => undefined,
    async clearAll() {
      members.clear();
      events.clear();
      suspensions.clear();
      joinRequests.clear();
      powerChanges.clear();
      store.attempts.length = 0;
      store.settings = undefined;
    },
  };
  return withChangeNotifications(repos);
}

const READ_METHODS = new Set(['list', 'get', 'getRoster', 'getSubmission', 'subscribe']);

/**
 * Like Supabase Realtime for the in-memory store: every write (including the join page's) notifies
 * the subscribers, so open screens and the Requests badge refresh in local development too.
 */
function withChangeNotifications(repos: Repositories): Repositories {
  const listeners = new Set<() => void>();
  const changed = () => listeners.forEach((listener) => listener());
  const wrap = <T extends object>(target: T): T => {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(target)) {
      if (typeof value === 'function' && !READ_METHODS.has(key)) {
        result[key] = async (...args: unknown[]) => {
          const out: unknown = await (value as (...a: unknown[]) => unknown)(...args);
          changed();
          return out;
        };
      } else if (typeof value === 'object' && value !== null) result[key] = wrap(value);
      else result[key] = value;
    }
    return result as T;
  };
  return {
    ...wrap(repos),
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
