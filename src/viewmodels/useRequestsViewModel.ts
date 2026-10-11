import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_ACTIVITY } from '@/constants/rules';
import { EVENT_SLOT_INFO } from '@/constants/events';
import { ConflictError, type Repositories } from '@/data/repositories';
import { isEditable } from '@/domain/events/eventLifecycle';
import { weekEventId } from '@/domain/events/weekEvents';
import { pendingJoinRequests, resolveJoinRequest } from '@/domain/join/joinRequests';
import { applyJoinChoice, evaluatePowerUpdate } from '@/domain/join/joinRules';
import { addAlias, createMember, validateMemberDraft } from '@/domain/roster/memberRules';
import { suggestMembersForName, type NameSuggestion } from '@/domain/roster/nameSuggestions';
import { createPowerChange, pendingPowerChanges, resolvePowerChange } from '@/domain/roster/powerChanges';
import { formatEventDate } from '@/helpers/dates';
import type { JoinRequest } from '@/models/JoinRequest';
import type { Member } from '@/models/Member';
import type { PowerChange } from '@/models/PowerChange';
import { EVENT_SLOTS, type WeekEvent } from '@/models/WeekEvent';
import { useAppServices } from './AppServicesContext';
import { useAppData } from './useAppData';
import { useAuth } from './AuthContext';
import { useToasts } from './ToastContext';

export interface JoinRequestView {
  request: JoinRequest;
  weekLabel: string;
  /** "Team A: play · Team B: sub only" */
  choicesLabel: string;
  suggestions: NameSuggestion[];
}

export interface PowerChangeView {
  change: PowerChange;
  memberName: string;
  rosterPower: number;
  /** Relative change vs the current roster power, e.g. +0.45 = +45%. */
  delta: number | null;
}

/** Applies `change` to the latest stored event, retrying when another user saved in between. */
async function mutateStoredEvent(repos: Repositories, id: string, change: (e: WeekEvent) => WeekEvent | null): Promise<boolean> {
  for (let attempt = 0; ; attempt++) {
    const latest = await repos.events.get(id);
    if (!latest) return false;
    const next = change(latest);
    if (!next) return false;
    if (next === latest) return true;
    try {
      await repos.events.save(next);
      return true;
    } catch (e) {
      if (!(e instanceof ConflictError) || attempt >= 2) throw e;
    }
  }
}

const CHOICE_LABEL = { none: 'not available', play: 'play', sub: 'sub only' } as const;

function summary(name: string, registered: string[], skipped: string[]): string {
  const done = registered.length ? `registered for ${registered.join(' and ')}` : 'no registration added';
  const note = skipped.length ? ` (${skipped.join(' and ')} no longer open or missing – add them by hand if needed)` : '';
  return `${name}: ${done}${note}.`;
}

/** Leaders' inbox: unlisted players asking to join, and self-reported power changes to review. */
export function useRequestsViewModel() {
  const { repos, now, newId } = useAppServices();
  const { notify } = useToasts();
  const { account } = useAuth();
  const data = useAppData();
  const { members, settings, joinRequests, powerChanges, reload } = data;
  const [busyId, setBusyId] = useState<string | null>(null);
  const resolvedBy = account?.displayName || account?.email || 'leader';
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const requests = useMemo<JoinRequestView[]>(
    () =>
      pendingJoinRequests(joinRequests).map((request) => ({
        request,
        weekLabel: formatEventDate(request.weekDate),
        choicesLabel: EVENT_SLOTS.map((s) => `${EVENT_SLOT_INFO[s].team}: ${CHOICE_LABEL[request.choices[s]]}`).join(' · '),
        suggestions: suggestMembersForName(request.name, members),
      })),
    [joinRequests, members],
  );

  const powerReviews = useMemo<PowerChangeView[]>(
    () =>
      pendingPowerChanges(powerChanges).map((change) => {
        const member = memberById.get(change.memberId);
        const rosterPower = member?.power ?? change.oldPower;
        return {
          change,
          memberName: member?.name ?? '(removed member)',
          rosterPower,
          delta: rosterPower > 0 ? change.newPower / rosterPower - 1 : null,
        };
      }),
    [powerChanges, memberById],
  );

  const run = useCallback(
    async (id: string, action: () => Promise<string>) => {
      setBusyId(id);
      try {
        notify(await action(), 'success');
      } catch (e) {
        notify(`Could not save: ${e instanceof Error ? e.message : 'unknown error'}`, 'error');
      } finally {
        setBusyId(null);
        await reload();
      }
    },
    [notify, reload],
  );

  /** Registers the member for the events requested (still open ones) and applies the power rule. */
  const registerFromRequest = useCallback(
    async (request: JoinRequest, member: Member, nowIso: string): Promise<{ registered: string[]; skipped: string[]; member: Member }> => {
      const registered: string[] = [];
      const skipped: string[] = [];
      for (const slot of EVENT_SLOTS) {
        const choice = request.choices[slot];
        if (choice === 'none') continue;
        const team = EVENT_SLOT_INFO[slot].team;
        const ok = await mutateStoredEvent(repos, weekEventId(request.weekDate, slot), (e) =>
          isEditable(e) ? applyJoinChoice(e, member.id, choice, request.power, request.updatedAt) : null,
        );
        (ok ? registered : skipped).push(team);
      }
      const outcome = evaluatePowerUpdate(member.power, request.power, settings);
      let updated = member;
      if (outcome !== 'unchanged') {
        const change = createPowerChange(
          { memberId: member.id, oldPower: member.power, newPower: request.power, source: 'self', status: outcome === 'applied' ? 'applied' : 'pending' },
          newId(),
          nowIso,
        );
        await repos.powerChanges.saveMany([change]);
        if (outcome === 'applied') updated = { ...member, power: request.power, updatedAt: nowIso };
      }
      return { registered, skipped, member: updated };
    },
    [repos, settings, newId],
  );

  /** "This is X": remembers the typed name as alias of X, registers X and applies the power rule. */
  const linkRequest = useCallback(
    (request: JoinRequest, memberId: string) =>
      run(request.id, async () => {
        const member = memberById.get(memberId);
        if (!member) throw new Error('Member not found.');
        const nowIso = now().toISOString();
        const withAlias = addAlias(member, request.name, nowIso);
        const { registered, skipped, member: updated } = await registerFromRequest(request, withAlias, nowIso);
        await repos.members.save(updated);
        await repos.joinRequests.save(resolveJoinRequest(request, 'approved', resolvedBy, nowIso, member.id));
        return summary(member.name, registered, skipped);
      }),
    [run, memberById, now, registerFromRequest, repos, resolvedBy],
  );

  /** Adds the player to the roster (activity 3, active) and registers them. */
  const createFromRequest = useCallback(
    (request: JoinRequest) =>
      run(request.id, async () => {
        const nowIso = now().toISOString();
        const draft = { name: request.name, power: request.power, activity: DEFAULT_ACTIVITY, active: true };
        const errors = validateMemberDraft(draft, members);
        if (errors.name) throw new Error(`${errors.name} Use “This is…” to link the request to that member instead.`);
        const member = createMember(draft, newId(), nowIso);
        const { registered, skipped } = await registerFromRequest(request, member, nowIso);
        await repos.members.save(member);
        await repos.joinRequests.save(resolveJoinRequest(request, 'approved', resolvedBy, nowIso, member.id));
        return `${member.name} added to the roster. ${summary(member.name, registered, skipped)}`;
      }),
    [run, now, members, newId, registerFromRequest, repos, resolvedBy],
  );

  const rejectRequest = useCallback(
    (request: JoinRequest) =>
      run(request.id, async () => {
        await repos.joinRequests.save(resolveJoinRequest(request, 'rejected', resolvedBy, now().toISOString()));
        return `Request of ${request.name} dismissed.`;
      }),
    [run, repos, resolvedBy, now],
  );

  const resolvePower = useCallback(
    (change: PowerChange, approve: boolean) =>
      run(change.id, async () => {
        const member = memberById.get(change.memberId);
        const result = resolvePowerChange(change, approve, member, resolvedBy, now().toISOString());
        if (result.member) await repos.members.save(result.member);
        await repos.powerChanges.saveMany([result.change]);
        return approve ? `${member?.name ?? 'Member'}: power updated.` : 'Power change rejected; the roster keeps its value.';
      }),
    [run, memberById, resolvedBy, now, repos],
  );

  return {
    loading: data.loading,
    requests,
    powerReviews,
    members: useMemo(() => [...members].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })), [members]),
    busyId,
    linkRequest,
    createFromRequest,
    rejectRequest,
    approvePower: (c: PowerChange) => resolvePower(c, true),
    rejectPower: (c: PowerChange) => resolvePower(c, false),
  };
}

export type RequestsViewModel = ReturnType<typeof useRequestsViewModel>;

/** Number of items waiting in the Requests tab (badge), kept live. */
export function usePendingRequestCount(enabled: boolean, refreshKey?: string): number {
  const { repos } = useAppServices();
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const load = async () => {
      try {
        const [requests, changes] = await Promise.all([repos.joinRequests.list(), repos.powerChanges.list()]);
        if (active) setCount(pendingJoinRequests(requests).length + pendingPowerChanges(changes).length);
      } catch {
        /* the badge is informative only */
      }
    };
    void load();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = repos.subscribe(() => {
      clearTimeout(timer);
      timer = setTimeout(() => void load(), 300);
    });
    return () => {
      active = false;
      clearTimeout(timer);
      unsubscribe();
    };
  }, [repos, enabled, refreshKey]);
  return count;
}
