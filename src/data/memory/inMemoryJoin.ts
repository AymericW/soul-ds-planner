import { JOIN_LIMITS } from '@/constants/rules';
import { upcomingEventDate, weekEventId } from '@/domain/events/weekEvents';
import { upsertUnlistedRequest } from '@/domain/join/joinRequests';
import {
  applyJoinChoice,
  choiceOfRegistration,
  evaluatePowerUpdate,
  isOpenForSelfRegistration,
  joinCodeMatches,
  NO_CHOICES,
  parseJoinChoices,
  validateJoinPower,
  validateUnlistedName,
} from '@/domain/join/joinRules';
import { createPowerChange, pendingPowerChangeOf } from '@/domain/roster/powerChanges';
import { normaliseName } from '@/helpers/normalise';
import type { JoinRequest } from '@/models/JoinRequest';
import type { Member } from '@/models/Member';
import type { PowerChange } from '@/models/PowerChange';
import type { Settings } from '@/models/Settings';
import type { Suspension } from '@/models/Suspension';
import { EVENT_SLOTS, type WeekEvent } from '@/models/WeekEvent';
import { JoinError, type JoinGateway } from '../repositories';
import { mergeWithDefaultSettings } from '../settingsMerge';

/** Mutable state shared by the in-memory repositories and their join gateway. */
export interface InMemoryStore {
  members: Map<string, Member>;
  events: Map<string, WeekEvent>;
  suspensions: Map<string, Suspension>;
  joinRequests: Map<string, JoinRequest>;
  powerChanges: Map<string, PowerChange>;
  settings: Settings | undefined;
  /** Rate-limit log, like the join_attempts table. */
  attempts: Array<{ kind: 'submit' | 'request' | 'request_all'; key: string; at: number }>;
}

interface Deps {
  now: () => Date;
  newId: () => string;
  ensureWeekEvents: () => Promise<void>;
}

const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Same behaviour as the join_* database functions (see supabase/migrations/0002_two_events_and_join.sql). */
export function createInMemoryJoinGateway(store: InMemoryStore, deps: Deps): JoinGateway {
  const settingsFor = (code: string): Settings => {
    const settings = mergeWithDefaultSettings(store.settings);
    if (!joinCodeMatches(settings.joinCode, code)) throw new JoinError('bad_code');
    return settings;
  };

  const weekEvents = () => {
    const date = upcomingEventDate(deps.now());
    return EVENT_SLOTS.map((slot) => ({ slot, event: store.events.get(weekEventId(date, slot)) }));
  };

  const rateLimit = (kind: 'submit' | 'request' | 'request_all', key: string, max: number, windowMinutes: number) => {
    const t = deps.now().getTime();
    store.attempts = store.attempts.filter((a) => t - a.at < 24 * 3600_000);
    const recent = store.attempts.filter((a) => a.kind === kind && a.key === key && t - a.at < windowMinutes * 60_000);
    if (recent.length >= max) throw new JoinError('rate_limited');
    store.attempts.push({ kind, key, at: t });
  };

  const activeMember = (id: string) => {
    const member = store.members.get(id);
    if (!member || !member.active) throw new JoinError('invalid_member');
    return member;
  };

  return {
    async getRoster(code) {
      settingsFor(code);
      await deps.ensureWeekEvents();
      const members = [...store.members.values()]
        .filter((m) => m.active)
        .map((m) => ({ id: m.id, name: m.name }))
        .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
      const events = weekEvents()
        .filter((x) => x.event)
        .map(({ event }) => ({ id: event!.id, slot: event!.slot, date: event!.date, status: event!.status }));
      return { members, events };
    },

    async getSubmission(code, memberId) {
      settingsFor(code);
      activeMember(memberId);
      const choices = { ...NO_CHOICES };
      let submittedAt: string | undefined;
      for (const { slot, event } of weekEvents()) {
        const registration = event?.registrations.find((r) => r.memberId === memberId);
        choices[slot] = choiceOfRegistration(registration);
        if (registration?.submittedAt && (!submittedAt || registration.submittedAt > submittedAt)) submittedAt = registration.submittedAt;
      }
      return { choices, ...(submittedAt ? { submittedAt } : {}) };
    },

    async submit(code, memberId, power, rawChoices) {
      const settings = settingsFor(code);
      const member = activeMember(memberId);
      if (validateJoinPower(power)) throw new JoinError('invalid_power');
      const choices = parseJoinChoices(rawChoices);
      if (!choices) throw new JoinError('invalid_choices');
      await deps.ensureWeekEvents();
      const targets = weekEvents();
      // All or nothing: a choice for an event that is no longer open rejects the whole submission.
      for (const { slot, event } of targets) {
        if (choices[slot] !== 'none' && !isOpenForSelfRegistration(event)) throw new JoinError('closed');
      }
      rateLimit('submit', memberId, JOIN_LIMITS.submitsPerMember, JOIN_LIMITS.submitWindowMinutes);

      const nowIso = deps.now().toISOString();
      const rounded = Math.round(power);
      for (const { slot, event } of targets) {
        if (!event || !isOpenForSelfRegistration(event)) continue;
        const next = applyJoinChoice(event, memberId, choices[slot], rounded, nowIso);
        if (next !== event) store.events.set(next.id, copy(next));
      }

      const outcome = evaluatePowerUpdate(member.power, rounded, settings);
      if (outcome === 'applied') {
        store.members.set(member.id, { ...member, power: rounded, updatedAt: nowIso });
        const change = createPowerChange({ memberId, oldPower: member.power, newPower: rounded, source: 'self', status: 'applied' }, deps.newId(), nowIso);
        store.powerChanges.set(change.id, change);
      } else if (outcome === 'pending') {
        const existing = pendingPowerChangeOf([...store.powerChanges.values()], memberId);
        const change: PowerChange = existing
          ? { ...existing, oldPower: member.power, newPower: rounded, source: 'self', createdAt: nowIso }
          : createPowerChange({ memberId, oldPower: member.power, newPower: rounded, source: 'self', status: 'pending' }, deps.newId(), nowIso);
        store.powerChanges.set(change.id, change);
      }
      return { power: outcome, choices };
    },

    async requestUnlisted(code, name, power, rawChoices) {
      settingsFor(code);
      if (validateUnlistedName(name)) throw new JoinError('invalid_name');
      if (validateJoinPower(power)) throw new JoinError('invalid_power');
      const choices = parseJoinChoices(rawChoices);
      if (!choices) throw new JoinError('invalid_choices');
      const weekDate = upcomingEventDate(deps.now());
      const all = [...store.joinRequests.values()];
      const key = normaliseName(name);
      const isUpdate = all.some((r) => r.status === 'pending' && r.normalisedName === key && r.weekDate === weekDate);
      if (!isUpdate && all.filter((r) => r.status === 'pending').length >= JOIN_LIMITS.maxPendingRequests) throw new JoinError('too_many_requests');
      if (!isUpdate) rateLimit('request_all', 'all', JOIN_LIMITS.requestsTotal, JOIN_LIMITS.requestWindowMinutes);
      rateLimit('request', key, JOIN_LIMITS.requestsPerName, JOIN_LIMITS.requestWindowMinutes);
      const request = upsertUnlistedRequest(all, { name, power: Math.round(power), choices, weekDate }, deps.newId(), deps.now().toISOString());
      store.joinRequests.set(request.id, request);
    },
  };
}
