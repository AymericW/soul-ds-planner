import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EVENT_SLOT_INFO } from '@/constants/events';
import { t } from '@/helpers/i18n';
import {
  addRegistrations,
  applySelectionToEvent,
  clearRegistrations,
  isEditable,
  isEventOver,
  lockEvent,
  markAttendedMany,
  registrationDrift,
  replaceAssignments,
  resetBuildingPlan,
  setBuildingPlan,
  setAttended,
  setNotified,
  setRegistered,
  setSubstituteOnly,
  syncPlanWithRegistrations,
  unlockEvent,
} from '@/domain/events/eventLifecycle';
import {
  lastFinalisedWeekKey,
  missingWeekEvents,
  openWeekKeys,
  otherEventsOfWeek,
  isRegistrationStillOpen,
  registrationCloseAt,
  registrationCloseDate,
  upcomingEventDate,
  weekEventsByKey,
  weekKeyOf,
} from '@/domain/events/weekEvents';
import { ConflictError } from '@/data/repositories';
import { BUILDING_INFO } from '@/constants/buildings';
import { buildBuildingImageContent, buildingImageFileName } from '@/domain/buildings/buildingImageContent';
import {
  buildingHasRoom,
  buildingsById,
  hasBuildingOverrides,
  moveToBuilding as moveToBuildingPlan,
  reconcileBuildingPlan,
  swapBuildings,
  unplacedStarters,
} from '@/domain/buildings/buildingPlan';
import { finaliseEvent } from '@/domain/penalties/finaliseEvent';
import { isPenalised, needsNotificationAnswer } from '@/domain/penalties/penaltyRules';
import { remainingSuspension } from '@/domain/penalties/suspensions';
import { addAlias, createMember, validateMemberDraft, type MemberDraftErrors } from '@/domain/roster/memberRules';
import { leaderPowerChange, pendingPowerChangeOf } from '@/domain/roster/powerChanges';
import { assignmentsBySlot, moveAssignment, swapAssignments } from '@/domain/selection/overrides';
import { buildPlanText } from '@/domain/selection/planText';
import { registrationCap, starterCount } from '@/domain/selection/runSelection';
import { attendanceConflict, placementConflict } from '@/domain/selection/weekConflicts';
import { selectWeek as planWeek } from '@/domain/selection/weekSelection';
import { formatEventDate, formatWeekday, weekStart } from '@/helpers/dates';
import { formatDuration, formatPower } from '@/helpers/format';
import type { NameCandidate, OcrMatchResult } from '@/helpers/nameMatching';
import { isStarterSlot, type Slot } from '@/models/Assignment';
import { BUILDINGS, type BuildingId } from '@/models/Building';
import type { Member, MemberDraft, MemberRank } from '@/models/Member';
import { EVENT_SLOTS, type EventSlot, type EventStatus, type WeekEvent } from '@/models/WeekEvent';
import { canShareFiles, downloadBlob, renderBuildingImage, shareFiles } from '@/services/buildingImageService';
import { copyText } from '@/services/clipboardService';
import { useAppServices } from './AppServicesContext';
import { useAppData } from './useAppData';
import { useScreenshotOcr } from './useScreenshotOcr';
import { useToasts } from './ToastContext';

export type WizardStep = 1 | 2 | 3 | 4;

export interface PlayerView {
  memberId: string;
  name: string;
  power: number;
  activity: number;
  rank?: MemberRank;
  slot: Slot;
  order: number;
  reason: string;
  overridden: boolean;
}

export interface RegistrationItem {
  memberId: string;
  name: string;
  power: number;
  activity: number;
  registered: boolean;
  substituteOnly: boolean;
  fromOcr: boolean;
  /** Registered by the player on the public join page. */
  selfRegistered: boolean;
  submittedAt?: string;
  enteredPower?: number;
  /** A self-reported power change waits for a leader (Requests tab). */
  powerPending: boolean;
  /** What the member has in the other event of the week, e.g. "Team B: play". */
  otherEventNote?: string;
  inactive: boolean;
  suspendedFor: number;
}

export interface AttendanceItem extends PlayerView {
  attended: boolean;
  notified: boolean;
  askNotified: boolean;
  willBeSuspended: boolean;
  fromOcr: boolean;
}

export interface EventTab {
  slot: EventSlot;
  team: string;
  timeLabel: string;
  /** Start time, 24h Paris time ("21:00"). */
  shortTime: string;
  status: EventStatus | null;
  registered: number;
}

function initialStep(event: WeekEvent | undefined): WizardStep {
  if (!event || event.status === 'registration') return 1;
  if (event.status === 'planned') return 2;
  return 4;
}

const toCandidate = (m: Member): NameCandidate => ({ id: m.id, name: m.name, aliases: m.aliases });

const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : t().common.unknownError);
const teamOf = (slot: EventSlot): string => t().events.team(slot);

export function useWeeklyEventViewModel() {
  const { repos, now, newId } = useAppServices();
  const { notify } = useToasts();
  const data = useAppData();
  const { members, events, suspensions, settings, powerChanges, reload } = data;

  // ---------- which week / which event (Team A or Team B) ----------
  const [chosenWeek, setChosenWeek] = useState<string | null>(null);
  const [chosenSlot, setChosenSlot] = useState<EventSlot>('A');
  const openWeeks = useMemo(() => openWeekKeys(events), [events]);
  const weekKey = chosenWeek && openWeeks.includes(chosenWeek) ? chosenWeek : openWeeks[0];
  const weekEvents = useMemo(() => (weekKey ? weekEventsByKey(events, weekKey) : {}), [events, weekKey]);
  const slot: EventSlot = weekEvents[chosenSlot] ? chosenSlot : weekEvents.A ? 'A' : weekEvents.B ? 'B' : chosenSlot;
  const event = weekEvents[slot];
  const otherEvents = useMemo(() => (event ? otherEventsOfWeek(events, event) : []), [events, event]);
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const [step, setStep] = useState<WizardStep>(1);
  // Re-render every minute so time-based labels (registration countdown, attendance opening) stay current.
  const [, setMinuteTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setMinuteTick((t) => t + 1), 60_000);
    return () => clearInterval(timer);
  }, []);
  const [stepEventId, setStepEventId] = useState<string | null>(null);
  const [pollOcrIds, setPollOcrIds] = useState<Set<string>>(new Set());
  const [attendanceOcrIds, setAttendanceOcrIds] = useState<Set<string>>(new Set());

  // Both events of the upcoming Friday are created automatically (idempotent, also done by the join page).
  const ensured = useRef(false);
  useEffect(() => {
    if (ensured.current) return;
    ensured.current = true;
    repos.events
      .ensureWeekEvents()
      .then(reload)
      .catch((e: unknown) => notify(t().week.createWeekFailed(errorMessage(e)), 'error'));
  }, [repos, reload, notify]);

  // Jump to the right step when an event is opened (or after reload of a different event).
  useEffect(() => {
    if (data.loading) return;
    if ((event?.id ?? null) !== stepEventId) {
      setStepEventId(event?.id ?? null);
      setStep(initialStep(event));
      setPollOcrIds(new Set());
      setAttendanceOcrIds(new Set());
    }
  }, [data.loading, event, stepEventId]);

  const nowIso = useCallback(() => now().toISOString(), [now]);

  /**
   * Applies a pure change to the CURRENT stored version of an event.
   * Changes are queued, so fast taps (or an OCR result arriving later) never
   * overwrite each other.
   */
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const mutateEventById = useCallback(
    (id: string | undefined, change: (latest: WeekEvent) => WeekEvent | null) => {
      if (!id) return Promise.resolve();
      const task = queue.current.then(async () => {
        // Another R4 (or a player on the join page) may save between our read and write: re-read and reapply.
        for (let attempt = 0; ; attempt++) {
          const latest = await repos.events.get(id);
          if (!latest) return;
          const next = change(latest);
          if (!next || next === latest) return;
          try {
            await repos.events.save(next);
            return;
          } catch (e) {
            if (!(e instanceof ConflictError) || attempt >= 2) throw e;
          }
        }
      });
      queue.current = task.catch(() => undefined);
      return task
        .catch((e: unknown) => {
          notify(
            e instanceof ConflictError ? t().week.conflictRedo : t().common.couldNotSave(errorMessage(e)),
            'error',
          );
        })
        .then(reload);
    },
    [repos, reload, notify],
  );

  const eventIdRef = useRef<string | undefined>(undefined);
  eventIdRef.current = event?.id;
  const mutateEvent = useCallback(
    (change: (latest: WeekEvent) => WeekEvent | null) => mutateEventById(eventIdRef.current, change),
    [mutateEventById],
  );

  // ---------- start / meta ----------
  const selectSlot = useCallback((next: EventSlot) => setChosenSlot(next), []);
  const chooseWeek = useCallback((key: string) => setChosenWeek(key), []);

  /** Creates the Team A and Team B events of a Friday (only the missing ones). */
  const startNewWeek = useCallback(
    async (date: string) => {
      const created = missingWeekEvents(events, date, nowIso());
      try {
        for (const e of created) await repos.events.save(e);
      } catch (e) {
        notify(t().week.createFailed(errorMessage(e)), 'error');
        await reload();
        return;
      }
      await reload();
      setChosenWeek(weekStart(date));
      notify(
        created.length ? t().week.created(formatEventDate(date)) : t().week.alreadyExist(formatEventDate(date)),
        'success',
      );
    },
    [events, nowIso, repos, reload, notify],
  );

  const discardEvent = useCallback(async () => {
    if (!event) return;
    try {
      await repos.events.delete(event.id);
    } catch (e) {
      notify(t().week.deleteFailed(errorMessage(e)), 'error');
      return;
    }
    await reload();
    notify(t().week.deleted(teamOf(event.slot), formatEventDate(event.date)), 'info');
  }, [event, repos, reload, notify]);

  // ---------- step 1: registrations ----------
  const candidates = useMemo(() => members.map(toCandidate), [members]);

  const onPollMatched = useCallback(
    (result: OcrMatchResult) => {
      const ids = result.matches.map((m) => m.memberId);
      setPollOcrIds(new Set(ids));
      void mutateEvent((e) => (isEditable(e) ? addRegistrations(e, ids, 'ocr', nowIso()) : null));
    },
    [mutateEvent, nowIso],
  );
  const pollOcr = useScreenshotOcr(candidates, onPollMatched);

  const registrationItems = useMemo<RegistrationItem[]>(() => {
    const registered = new Map(event?.registrations.map((r) => [r.memberId, r]) ?? []);
    const elsewhere = new Map<string, string>();
    for (const other of otherEvents) {
      for (const r of other.registrations) elsewhere.set(r.memberId, t().week.otherEventNote(teamOf(other.slot), Boolean(r.substituteOnly)));
    }
    return [...members]
      .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
      .map((m) => {
        const r = registered.get(m.id);
        return {
          memberId: m.id,
          name: m.name,
          power: m.power,
          activity: m.activity,
          registered: Boolean(r),
          substituteOnly: Boolean(r?.substituteOnly),
          fromOcr: pollOcrIds.has(m.id) || r?.source === 'ocr',
          selfRegistered: r?.source === 'self',
          submittedAt: r?.submittedAt,
          enteredPower: r?.enteredPower,
          powerPending: Boolean(pendingPowerChangeOf(powerChanges, m.id)),
          otherEventNote: elsewhere.get(m.id),
          inactive: !m.active,
          suspendedFor: remainingSuspension(m.id, suspensions),
        };
      });
  }, [members, event, otherEvents, pollOcrIds, suspensions, powerChanges]);

  const toggleRegistration = useCallback(
    async (memberId: string) => {
      if (!event || !isEditable(event)) return;
      await mutateEvent((e) =>
        isEditable(e) ? setRegistered(e, memberId, !e.registrations.some((r) => r.memberId === memberId), 'manual', nowIso()) : null,
      );
    },
    [event, mutateEvent, nowIso],
  );

  const toggleSubstituteOnly = useCallback(
    async (memberId: string) => {
      if (!event || !isEditable(event)) return;
      await mutateEvent((e) =>
        isEditable(e)
          ? setSubstituteOnly(e, memberId, !e.registrations.find((r) => r.memberId === memberId)?.substituteOnly, nowIso())
          : null,
      );
    },
    [event, mutateEvent, nowIso],
  );

  const clearAllRegistrations = useCallback(async () => {
    if (!event || !isEditable(event)) return;
    await mutateEvent((e) => clearRegistrations(e, nowIso()));
    setPollOcrIds(new Set());
  }, [event, mutateEvent, nowIso]);

  const quickAddMember = useCallback(
    async (draft: MemberDraft): Promise<MemberDraftErrors> => {
      const errors = validateMemberDraft(draft, members);
      if (Object.keys(errors).length) return errors;
      const member = createMember(draft, newId(), nowIso());
      try {
        await repos.members.save(member);
      } catch (e) {
        // Shown in the form, which stays open so nothing typed is lost.
        return { name: t().common.couldNotSave(errorMessage(e)) };
      }
      if (event && isEditable(event)) await mutateEvent((e) => setRegistered(e, member.id, true, 'manual', nowIso()));
      else await reload();
      notify(t().week.addedRegistered(member.name), 'success');
      return {};
    },
    [members, newId, nowIso, repos, event, mutateEvent, reload, notify],
  );

  /** Leader edit of a member's power from the poll list (kept in the power history). */
  const updateMemberPower = useCallback(
    async (memberId: string, power: number) => {
      const member = memberById.get(memberId);
      if (!member || !(power >= 0) || power === member.power) return;
      const iso = nowIso();
      const updated = { ...member, power: Math.round(power), updatedAt: iso };
      try {
        await repos.members.save(updated);
        const change = leaderPowerChange(member, updated, newId(), iso);
        if (change) await repos.powerChanges.saveMany([change]);
      } catch (e) {
        notify(t().week.powerSaveFailed(member.name, errorMessage(e)), 'error');
        await reload();
        return;
      }
      await reload();
      notify(t().week.powerSet(member.name, formatPower(updated.power)), 'success');
    },
    [memberById, nowIso, repos, newId, reload, notify],
  );

  const registeredCount = event?.registrations.length ?? 0;
  const substituteOnlyCount = event?.registrations.filter((r) => r.substituteOnly).length ?? 0;
  const selfRegisteredCount = event?.registrations.filter((r) => r.source === 'self').length ?? 0;
  const cap = registrationCap(settings);
  const starters = starterCount(settings);

  // ---------- step 2: selection (week level: Team A and Team B never share a player) ----------
  const otherEditable = otherEvents.filter(isEditable);
  const canRunBoth = Boolean(event && isEditable(event) && otherEditable.length > 0);

  const runWeeklySelection = useCallback(
    async (scope: 'this' | 'both' = 'this') => {
      if (!event || !isEditable(event)) return;
      // Hard rule: no selection before Wednesday 10 PM (Paris), while players can still register.
      if (isRegistrationStillOpen(event.date, now())) {
        notify(t().week.tooEarly(t().events.closeLabel(formatEventDate(registrationCloseDate(event.date)))), 'error');
        return;
      }
      const weekList = [event, ...otherEvents];
      // The other event is resolved together when it has no plan yet (so the two boards are balanced),
      // or when the leader asked for both; otherwise its current plan is respected.
      const together = otherEvents.filter((o) => (scope === 'both' ? isEditable(o) : o.status === 'registration')).map((o) => o.slot);
      const { results, order } = planWeek({
        members,
        events,
        weekEvents: weekList,
        targets: [event.slot, ...together],
        suspensions,
        settings,
      });
      const toSave = scope === 'both' ? [event.slot, ...together] : [event.slot];
      for (const s of toSave) {
        const result = results[s];
        const target = weekList.find((e) => e.slot === s);
        if (result && target) await mutateEventById(target.id, (e) => (isEditable(e) ? applySelectionToEvent(e, result.assignments, settings, nowIso()) : null));
      }
      setStep(2);
      const mine = results[event.slot];
      if (!mine) return;
      const { eligible } = mine.summary;
      // Registered here but listed in the other event of the week (its new plan, or its kept one).
      const listedElsewhere = new Set(
        EVENT_SLOTS.filter((s) => s !== event.slot).flatMap((s) =>
          (results[s]?.assignments ?? weekList.find((e) => e.slot === s)?.assignments ?? [])
            .filter((a) => a.slot !== 'notSelected')
            .map((a) => a.memberId),
        ),
      );
      const elsewhere = mine.assignments.filter((a) => a.slot === 'notSelected' && listedElsewhere.has(a.memberId)).length;
      const parts = [eligible > cap ? t().week.selectionOver(eligible, cap) : t().week.selectionAll(eligible)];
      if (elsewhere > 0) parts.push(t().week.elsewhere(elsewhere));
      if (scope === 'both') parts.push(t().week.bothPlanned(order.map(teamOf)));
      notify(parts.join(' '), 'success');
    },
    [event, otherEvents, members, events, suspensions, settings, mutateEventById, now, nowIso, notify, cap],
  );

  const playerView = useCallback(
    (a: WeekEvent['assignments'][number]): PlayerView => {
      const m = memberById.get(a.memberId);
      return {
        memberId: a.memberId,
        name: m?.name ?? t().common.removedMember,
        power: m?.power ?? 0,
        activity: m?.activity ?? 0,
        rank: m?.rank,
        slot: a.slot,
        order: a.order,
        reason: a.reason,
        overridden: Boolean(a.overridden),
      };
    },
    [memberById],
  );

  const board = useMemo(() => {
    const slots = assignmentsBySlot(event?.assignments ?? []);
    return {
      core: slots.core.map(playerView),
      rotation: slots.rotation.map(playerView),
      substitute: slots.substitute.map(playerView),
      notSelected: slots.notSelected.map(playerView),
    };
  }, [event, playerView]);

  const drift = useMemo(() => (event ? registrationDrift(event) : { lateAdds: [], withdrawn: [] }), [event]);
  const hasOverrides = Boolean(event?.assignments.some((a) => a.overridden));
  /** Manual moves in this event or in the other editable event of the week (both are lost when both are re-planned). */
  const weekHasOverrides = hasOverrides || otherEditable.some((o) => o.assignments.some((a) => a.overridden));
  /** Team A and Team B are planned together by default, so R4s cannot produce overlapping lineups by running them one at a time. */
  const defaultScope: 'this' | 'both' = canRunBoth ? 'both' : 'this';

  /** Manual moves are checked against the other event of the week in the domain layer. */
  const movePlayer = useCallback(
    async (memberId: string, to: Slot) => {
      if (!event || !isEditable(event)) return;
      const conflict = placementConflict(memberId, to, otherEvents);
      if (conflict) {
        notify(`${memberById.get(memberId)?.name ?? t().week.thisPlayer}: ${conflict}`, 'error');
        return;
      }
      await mutateEvent((e) => replaceAssignments(e, moveAssignment(e.assignments, memberId, to), nowIso()));
    },
    [event, otherEvents, memberById, mutateEvent, nowIso, notify],
  );

  const swapPlayers = useCallback(
    async (a: string, b: string) => {
      if (!event || !isEditable(event)) return;
      const slotA = event.assignments.find((x) => x.memberId === a)?.slot;
      const slotB = event.assignments.find((x) => x.memberId === b)?.slot;
      if (!slotA || !slotB) return;
      const conflict =
        (placementConflict(a, slotB, otherEvents) && { id: a, text: placementConflict(a, slotB, otherEvents) }) ||
        (placementConflict(b, slotA, otherEvents) && { id: b, text: placementConflict(b, slotA, otherEvents) });
      if (conflict) {
        notify(`${memberById.get(conflict.id)?.name ?? t().week.thisPlayer}: ${conflict.text}`, 'error');
        return;
      }
      await mutateEvent((e) => replaceAssignments(e, swapAssignments(e.assignments, a, b), nowIso()));
    },
    [event, otherEvents, memberById, mutateEvent, nowIso, notify],
  );

  const keepPlanWithLateChanges = useCallback(async () => {
    if (!event || !isEditable(event)) return;
    await mutateEvent((e) => syncPlanWithRegistrations(e, nowIso(), otherEvents));
    notify(t().week.lateAdded, 'success');
  }, [event, otherEvents, mutateEvent, nowIso, notify]);

  // ---------- step 3: lock ----------
  const planText = useMemo(() => (event ? buildPlanText(event, members) : ''), [event, members]);

  /** Opens attendance: freezes the lineup. Hard rule: only once the event has ended (A 21:30, B 12:30 Paris time). */
  const eventOver = event ? isEventOver(event, now()) : false;
  /** "Fri 21:30" – when attendance opens. */
  const eventEndShort = event ? `${formatWeekday(event.date)} ${EVENT_SLOT_INFO[event.slot].endTime}` : '';
  /** Running the selection before Wednesday 10 PM (Paris) cuts off players who could still register. */
  const registrationStillOpen = event ? isRegistrationStillOpen(event.date, now()) : false;
  const registrationCloseLabel = event ? t().events.closeLabel(formatEventDate(registrationCloseDate(event.date))) : '';
  /** "Wed 22:00" – the short form for the join-link strip. */
  const registrationCloseShort = event ? `${formatWeekday(registrationCloseDate(event.date))} 22:00` : '';
  const registrationClosesIn = event && registrationStillOpen ? formatDuration(registrationCloseAt(event.date).getTime() - now().getTime()) : '';
  const startAttendance = useCallback(async () => {
    if (!event || event.status === 'registration') return;
    if (!isEventOver(event, now())) {
      notify(t().week.attendanceTooEarly(teamOf(event.slot), eventEndShort), 'error');
      return;
    }
    await mutateEvent((e) => lockEvent(e, nowIso()));
    setStep(4);
  }, [event, mutateEvent, now, nowIso, notify, eventEndShort]);

  /** Opening the attendance step on a planned event starts attendance (locks the lineup) first. */
  const goToStep = useCallback(
    (next: WizardStep) => {
      if (next === 4 && event?.status === 'planned') void startAttendance();
      else setStep(next);
    },
    [event, startAttendance],
  );

  /** Attendance changes on an event that is over but still planned lock it in the same save. */
  const forAttendance = useCallback(
    (e: WeekEvent): WeekEvent | null => {
      if (e.status === 'planned' && isEventOver(e, now())) return lockEvent(e, nowIso());
      return e.status === 'locked' ? e : null;
    },
    [now, nowIso],
  );

  /** Back to planning (e.g. attendance was opened too early); the lineup becomes editable again. */
  const unlockPlan = useCallback(async () => {
    if (!event) return;
    await mutateEvent((e) => unlockEvent(e, nowIso()));
    setStep(2);
  }, [event, mutateEvent, nowIso]);

  const copyPlan = useCallback(async () => {
    const ok = await copyText(planText);
    notify(ok ? t().week.planCopied : t().week.planCopyFailed, ok ? 'success' : 'warning');
  }, [planText, notify]);

  // ---------- step 3: buildings + shared image ----------
  /** Starters on the Desert Storm buildings: auto-filled from power until an R4 moves someone. */
  const buildingPlan = useMemo(
    () => (event && event.status !== 'registration' ? reconcileBuildingPlan(event.buildings, event.assignments, members) : []),
    [event, members],
  );
  const buildingsEditable = event?.status === 'planned' || event?.status === 'locked';
  const hasBuildingMoves = hasBuildingOverrides(buildingPlan);

  const buildingBoard = useMemo(() => {
    const toPlayer = (memberId: string, overridden: boolean) => {
      const m = memberById.get(memberId);
      return { memberId, name: m?.name ?? t().common.removedMember, power: m?.power ?? 0, overridden };
    };
    const byBuilding = buildingsById(buildingPlan);
    return {
      buildings: BUILDINGS.map((id) => ({
        id,
        label: BUILDING_INFO[id].label,
        capacity: BUILDING_INFO[id].capacity,
        players: byBuilding[id].map((a) => toPlayer(a.memberId, Boolean(a.overridden))),
      })),
      unplaced: event ? unplacedStarters(buildingPlan, event.assignments, members).map((id) => toPlayer(id, false)) : [],
    };
  }, [buildingPlan, event, members, memberById]);

  /** Targets of a manual move, with the free places left. */
  const buildingTargets = useMemo(
    () =>
      BUILDINGS.map((id) => ({
        id,
        label: BUILDING_INFO[id].label,
        free: BUILDING_INFO[id].capacity - buildingPlan.filter((a) => a.building === id).length,
      })),
    [buildingPlan],
  );

  const moveToBuilding = useCallback(
    async (memberId: string, to: BuildingId) => {
      if (!event || !buildingsEditable) return;
      if (!buildingHasRoom(buildingPlan, to)) {
        notify(t().week.buildingFull(BUILDING_INFO[to].label), 'warning');
        return;
      }
      await mutateEvent((e) => {
        const plan = reconcileBuildingPlan(e.buildings, e.assignments, members);
        if (!buildingHasRoom(plan, to)) return null;
        return setBuildingPlan(e, moveToBuildingPlan(plan, memberId, to), nowIso());
      });
    },
    [event, buildingsEditable, buildingPlan, members, mutateEvent, nowIso, notify],
  );

  const swapBuildingPlayers = useCallback(
    async (a: string, b: string) => {
      if (!event || !buildingsEditable) return;
      await mutateEvent((e) => setBuildingPlan(e, swapBuildings(reconcileBuildingPlan(e.buildings, e.assignments, members), a, b), nowIso()));
    },
    [event, buildingsEditable, members, mutateEvent, nowIso],
  );

  const resetBuildings = useCallback(async () => {
    if (!event || !buildingsEditable) return;
    await mutateEvent((e) => resetBuildingPlan(e, nowIso()));
    notify(t().week.refilled, 'success');
  }, [event, buildingsEditable, mutateEvent, nowIso, notify]);

  const buildingImageContent = useMemo(
    () => (event && event.status !== 'registration' ? buildBuildingImageContent(event, buildingPlan, members) : null),
    [event, buildingPlan, members],
  );

  // Live preview of the PNG; re-drawn whenever the plan changes.
  const [buildingImage, setBuildingImage] = useState<{ url: string; blob: Blob; eventId: string } | null>(null);
  const [buildingImageError, setBuildingImageError] = useState<string | null>(null);
  useEffect(() => {
    if (!buildingImageContent || !event) {
      setBuildingImage(null);
      return;
    }
    let cancelled = false;
    const eventId = event.id;
    renderBuildingImage(buildingImageContent)
      .then((blob) => {
        if (cancelled) return;
        setBuildingImageError(null);
        setBuildingImage({ url: URL.createObjectURL(blob), blob, eventId });
      })
      .catch((e: unknown) => {
        if (!cancelled) setBuildingImageError(t().week.drawFailed(errorMessage(e)));
      });
    return () => {
      cancelled = true;
    };
  }, [buildingImageContent, event]);
  useEffect(
    () => () => {
      if (buildingImage) URL.revokeObjectURL(buildingImage.url);
    },
    [buildingImage],
  );

  /** The PNGs to export: this team, plus the other team of the week when it is planned. */
  const renderImages = useCallback(
    async (scope: 'this' | 'both'): Promise<File[]> => {
      if (!event || !buildingImageContent) return [];
      const targets = scope === 'both' ? [event, ...otherEvents.filter((o) => o.status !== 'registration')] : [event];
      const files: File[] = [];
      for (const target of targets) {
        const content =
          target.id === event.id
            ? buildingImageContent
            : buildBuildingImageContent(target, reconcileBuildingPlan(target.buildings, target.assignments, members), members);
        const blob = target.id === event.id && buildingImage?.eventId === event.id ? buildingImage.blob : await renderBuildingImage(content);
        files.push(new File([blob], buildingImageFileName(target), { type: 'image/png' }));
      }
      return files;
    },
    [event, otherEvents, buildingImageContent, buildingImage, members],
  );

  const otherTeamHasPlan = otherEvents.some((o) => o.status !== 'registration');

  const downloadBuildingImage = useCallback(
    async (scope: 'this' | 'both' = 'this') => {
      try {
        const files = await renderImages(scope);
        for (const file of files) downloadBlob(file, file.name);
        if (files.length) notify(files.length === 1 ? t().week.imageSaved(files[0]!.name) : t().week.imagesSaved(files.length), 'success');
      } catch (e) {
        notify(t().week.imageFailed(errorMessage(e)), 'error');
      }
    },
    [renderImages, notify],
  );

  const canShareImage = useMemo(() => canShareFiles(), []);
  const shareBuildingImage = useCallback(
    async (scope: 'this' | 'both' = 'this') => {
      if (!event) return;
      try {
        const files = await renderImages(scope);
        if (!files.length) return;
        const ok = await shareFiles(files, t().week.shareTitle(teamOf(event.slot), formatEventDate(event.date)));
        if (!ok) notify(t().week.shareCancelled, 'info');
      } catch (e) {
        notify(t().week.shareFailed(errorMessage(e)), 'error');
      }
    },
    [renderImages, event, notify],
  );

  // ---------- step 4: attendance ----------
  const lineupCandidates = useMemo(
    () =>
      (event?.assignments ?? [])
        .filter((a) => a.slot !== 'notSelected')
        .map((a) => memberById.get(a.memberId))
        .filter((m): m is Member => Boolean(m))
        .map(toCandidate),
    [event, memberById],
  );

  const onAttendanceMatched = useCallback(
    (result: OcrMatchResult) => {
      const ids = result.matches.map((m) => m.memberId);
      const blocked = ids.filter((id) => attendanceConflict(id, otherEvents));
      const allowed = ids.filter((id) => !blocked.includes(id));
      setAttendanceOcrIds(new Set(allowed));
      if (blocked.length) {
        notify(t().week.notMarked(blocked.map((id) => memberById.get(id)?.name ?? id).join(', ')), 'warning');
      }
      void mutateEvent((latest) => {
        const e = forAttendance(latest);
        return e ? markAttendedMany(e, allowed, nowIso()) : null;
      });
    },
    [mutateEvent, nowIso, otherEvents, memberById, notify, forAttendance],
  );
  const attendanceOcr = useScreenshotOcr(lineupCandidates, onAttendanceMatched);

  // Switching between Team A and Team B (or weeks) never lets an OCR result land on the wrong event.
  const clearPollOcr = pollOcr.clear;
  const clearAttendanceOcr = attendanceOcr.clear;
  useEffect(() => {
    clearPollOcr();
    clearAttendanceOcr();
  }, [event?.id, clearPollOcr, clearAttendanceOcr]);

  /** User says "this unrecognised OCR line is X": remember the spelling and register X. */
  const assignUnmatched = useCallback(
    async (guess: string, memberId: string, target: 'poll' | 'attendance') => {
      const member = memberById.get(memberId);
      if (!member || !event) return;
      if (target === 'attendance') {
        const conflict = attendanceConflict(memberId, otherEvents);
        if (conflict) {
          notify(`${member.name}: ${conflict}`, 'error');
          return;
        }
      }
      const updated = addAlias(member, guess, nowIso());
      try {
        if (updated !== member) await repos.members.save(updated);
      } catch (e) {
        notify(t().week.aliasFailed(guess, member.name, errorMessage(e)), 'error');
        return;
      }
      if (target === 'poll') {
        pollOcr.dismissUnmatched(guess);
        if (isEditable(event)) await mutateEvent((e) => setRegistered(e, memberId, true, 'ocr', nowIso()));
        else await reload();
      } else {
        attendanceOcr.dismissUnmatched(guess);
        await mutateEvent((latest) => {
          const e = forAttendance(latest);
          return e ? markAttendedMany(e, [memberId], nowIso()) : null;
        });
      }
      notify(t().week.aliasSaved(guess, member.name), 'success');
    },
    [memberById, event, otherEvents, nowIso, repos, mutateEvent, reload, notify, pollOcr, attendanceOcr, forAttendance],
  );

  const attendanceItems = useMemo<AttendanceItem[]>(() => {
    if (!event) return [];
    const records = new Map(event.attendance.map((a) => [a.memberId, a]));
    return [...board.core, ...board.rotation, ...board.substitute].map((p) => {
      const record = records.get(p.memberId);
      const attended = record?.attended ?? false;
      const notified = record?.notified ?? false;
      return {
        ...p,
        attended,
        notified,
        askNotified: needsNotificationAnswer(p.slot, record),
        willBeSuspended: settings.suspensionEvents > 0 && isPenalised(p.slot, record),
        fromOcr: attendanceOcrIds.has(p.memberId),
      };
    });
  }, [event, board, attendanceOcrIds, settings.suspensionEvents]);

  const toggleAttended = useCallback(
    async (memberId: string) => {
      if (!event || !forAttendance(event)) return;
      const willAttend = !(event.attendance.find((a) => a.memberId === memberId)?.attended ?? false);
      const conflict = willAttend ? attendanceConflict(memberId, otherEvents) : null;
      if (conflict) {
        notify(`${memberById.get(memberId)?.name ?? t().week.thisPlayer}: ${conflict}`, 'error');
        return;
      }
      await mutateEvent((latest) => {
        const e = forAttendance(latest);
        return e ? setAttended(e, memberId, !(e.attendance.find((a) => a.memberId === memberId)?.attended ?? false), nowIso()) : null;
      });
    },
    [event, otherEvents, memberById, mutateEvent, nowIso, notify, forAttendance],
  );

  const setMemberNotified = useCallback(
    async (memberId: string, notified: boolean) => {
      if (!event || !forAttendance(event)) return;
      await mutateEvent((latest) => {
        const e = forAttendance(latest);
        return e ? setNotified(e, memberId, notified, nowIso()) : null;
      });
    },
    [event, mutateEvent, nowIso, forAttendance],
  );

  const penaltyPreview = useMemo(() => attendanceItems.filter((i) => i.willBeSuspended), [attendanceItems]);
  const attendanceSummary = useMemo(
    () => ({
      startersPresent: attendanceItems.filter((i) => isStarterSlot(i.slot) && i.attended).length,
      starters: attendanceItems.filter((i) => isStarterSlot(i.slot)).length,
      subsUsed: attendanceItems.filter((i) => i.slot === 'substitute' && i.attended).length,
    }),
    [attendanceItems],
  );

  const finalise = useCallback(async () => {
    if (!event || event.status !== 'locked') return;
    const result = finaliseEvent({
      event,
      attendance: event.attendance,
      suspensions,
      settings,
      nowIso: nowIso(),
      newId,
      sameWeekEvents: otherEvents,
    });
    try {
      await repos.finaliseEvent(result.event, result.suspensions, suspensions);
    } catch (e) {
      await reload();
      notify(
        e instanceof ConflictError ? t().week.finaliseConflict : t().week.finaliseFailed(errorMessage(e)),
        'error',
      );
      return;
    }
    await reload();
    attendanceOcr.clear();
    pollOcr.clear();
    setPollOcrIds(new Set());
    setAttendanceOcrIds(new Set());
    notify(
      result.issued.length
        ? t().week.finalisedWithPenalties(teamOf(event.slot), result.issued.length, t().count.week(settings.suspensionEvents))
        : t().week.finalisedNoPenalties(teamOf(event.slot)),
      'success',
    );
  }, [event, otherEvents, suspensions, settings, nowIso, newId, repos, reload, attendanceOcr, pollOcr, notify]);

  /** Loads one of the bundled sample screenshots (public/samples) to try OCR without a real screenshot. */
  const loadSample = useCallback(
    async (file: 'demo-poll.png' | 'demo-attendance.png') => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}samples/${file}`);
        if (!response.ok) throw new Error(String(response.status));
        return await response.blob();
      } catch {
        notify(t().week.sampleFailed, 'error');
        return null;
      }
    },
    [notify],
  );

  const tryPollSample = useCallback(async () => {
    const blob = await loadSample('demo-poll.png');
    if (blob) await pollOcr.run(blob);
  }, [loadSample, pollOcr]);

  const tryAttendanceSample = useCallback(async () => {
    const blob = await loadSample('demo-attendance.png');
    if (blob) await attendanceOcr.run(blob);
  }, [loadSample, attendanceOcr]);

  const previousSummary = useMemo(() => {
    const key = lastFinalisedWeekKey(events);
    if (!key) return null;
    const week = Object.values(weekEventsByKey(events, key));
    const issuedIds = new Set(week.flatMap((e) => e.suspensionIdsIssued));
    const issued = suspensions.filter((s) => issuedIds.has(s.id));
    return {
      label: formatEventDate(week[0]?.date ?? key),
      played: week.reduce((n, e) => n + e.attendance.filter((a) => a.attended).length, 0),
      suspendedNames: issued.map((s) => memberById.get(s.memberId)?.name ?? t().common.removedMember),
    };
  }, [events, suspensions, memberById]);

  const eventTabs = useMemo<EventTab[]>(
    () =>
      EVENT_SLOTS.map((s) => ({
        slot: s,
        team: teamOf(s),
        timeLabel: t().events.timeLabel(s),
        shortTime: `${EVENT_SLOT_INFO[s].startHour}:00`,
        status: weekEvents[s]?.status ?? null,
        registered: weekEvents[s]?.registrations.length ?? 0,
      })),
    [weekEvents],
  );

  const weekOptions = useMemo(
    () =>
      openWeeks.map((key) => {
        const any = Object.values(weekEventsByKey(events, key))[0];
        return { key, label: any ? formatEventDate(any.date) : key };
      }),
    [openWeeks, events],
  );

  const unlockedSteps: Record<WizardStep, boolean> = {
    1: Boolean(event),
    2: Boolean(event && event.status !== 'registration'),
    3: Boolean(event && event.status !== 'registration'),
    4: event?.status === 'locked' || (event?.status === 'planned' && eventOver),
  };

  // The join link for players (built from the saved code), shown on the poll step.
  const joinLink = useMemo(() => {
    if (!settings.joinCode || typeof window === 'undefined') return null;
    const { origin, pathname } = window.location;
    return `${origin}${pathname}#/join?code=${encodeURIComponent(settings.joinCode)}`;
  }, [settings.joinCode]);
  const copyJoinLink = useCallback(async () => {
    if (!joinLink) return;
    const ok = await copyText(joinLink);
    notify(ok ? t().common.joinLinkCopied : t().common.copyFailed, ok ? 'success' : 'warning');
  }, [joinLink, notify]);
  /** Leaders sign themselves up through the same join page, inside the app (it offers a way back). */
  const openJoinPage = useCallback(() => {
    if (settings.joinCode) window.location.hash = `/join?code=${encodeURIComponent(settings.joinCode)}`;
  }, [settings.joinCode]);

  return {
    loading: data.loading,
    hasMembers: members.length > 0,
    event,
    slot,
    team: teamOf(slot),
    timeLabel: t().events.timeLabel(slot),
    eventTabs,
    selectSlot,
    weekKey: event ? weekKeyOf(event) : weekKey,
    weekOptions,
    chooseWeek,
    otherEventLocked: otherEvents.some((o) => !isEditable(o)),
    editable: event ? isEditable(event) : false,
    defaultDate: upcomingEventDate(now()),
    previousSummary,
    settings,
    cap,
    starters,
    step,
    setStep: goToStep,
    unlockedSteps,
    startNewWeek,
    discardEvent,
    joinLink,
    copyJoinLink,
    openJoinPage,
    // step 1
    pollOcr,
    tryPollSample,
    registrationItems,
    registeredCount,
    substituteOnlyCount,
    selfRegisteredCount,
    toggleRegistration,
    toggleSubstituteOnly,
    clearAllRegistrations,
    assignUnmatched,
    quickAddMember,
    updateMemberPower,
    runWeeklySelection,
    canRunBoth,
    registrationStillOpen,
    registrationCloseLabel,
    registrationCloseShort,
    registrationClosesIn,
    // step 2
    board,
    drift,
    hasOverrides,
    weekHasOverrides,
    defaultScope,
    movePlayer,
    swapPlayers,
    keepPlanWithLateChanges,
    // step 3
    planText,
    copyPlan,
    buildingBoard,
    buildingTargets,
    buildingsEditable,
    hasBuildingMoves,
    moveToBuilding,
    swapBuildingPlayers,
    resetBuildings,
    buildingImageUrl: buildingImage?.eventId === event?.id ? (buildingImage?.url ?? null) : null,
    buildingImageError,
    downloadBuildingImage,
    canShareImage,
    shareBuildingImage,
    otherTeamHasPlan,
    eventOver,
    eventEndShort,
    startAttendance,
    unlockPlan,
    // step 4
    attendanceOcr,
    tryAttendanceSample,
    attendanceItems,
    attendanceSummary,
    toggleAttended,
    setMemberNotified,
    penaltyPreview,
    finalise,
  };
}

export type WeeklyEventViewModel = ReturnType<typeof useWeeklyEventViewModel>;
