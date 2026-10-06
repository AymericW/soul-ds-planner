import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addRegistrations,
  applySelectionToEvent,
  clearRegistrations,
  createWeekEvent,
  currentOpenEvent,
  isEditable,
  isEventOver,
  lastFinalisedEvent,
  lockEvent,
  markAttendedMany,
  registrationDrift,
  replaceAssignments,
  setAttended,
  setEventDate,
  setNotified,
  setRegistered,
  syncPlanWithRegistrations,
  unlockEvent,
} from '@/domain/events/eventLifecycle';
import { ConflictError } from '@/data/repositories';
import { finaliseEvent } from '@/domain/penalties/finaliseEvent';
import { isPenalised, needsNotificationAnswer } from '@/domain/penalties/penaltyRules';
import { remainingSuspension } from '@/domain/penalties/suspensions';
import { addAlias, createMember, validateMemberDraft, type MemberDraftErrors } from '@/domain/roster/memberRules';
import { assignmentsBySlot, moveAssignment, swapAssignments } from '@/domain/selection/overrides';
import { buildPlanText } from '@/domain/selection/planText';
import { registrationCap, runSelection, starterCount } from '@/domain/selection/runSelection';
import { toIsoDate } from '@/helpers/dates';
import type { NameCandidate, OcrMatchResult } from '@/helpers/nameMatching';
import { isStarterSlot, type Slot } from '@/models/Assignment';
import type { Member, MemberDraft, MemberRank } from '@/models/Member';
import type { WeekEvent } from '@/models/WeekEvent';
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
  fromOcr: boolean;
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

function initialStep(event: WeekEvent | undefined): WizardStep {
  if (!event || event.status === 'registration') return 1;
  if (event.status === 'planned') return 2;
  return 4;
}

const toCandidate = (m: Member): NameCandidate => ({ id: m.id, name: m.name, aliases: m.aliases });

export function useWeeklyEventViewModel() {
  const { repos, now, newId } = useAppServices();
  const { notify } = useToasts();
  const data = useAppData();
  const { members, events, suspensions, settings, reload } = data;

  const event = useMemo(() => currentOpenEvent(events), [events]);
  const previous = useMemo(() => lastFinalisedEvent(events), [events]);
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const [step, setStep] = useState<WizardStep>(1);
  const [stepEventId, setStepEventId] = useState<string | null>(null);
  const [pollOcrIds, setPollOcrIds] = useState<Set<string>>(new Set());
  const [attendanceOcrIds, setAttendanceOcrIds] = useState<Set<string>>(new Set());

  // Jump to the right step when an event is opened (or after reload of a different event).
  useEffect(() => {
    if (data.loading) return;
    if ((event?.id ?? null) !== stepEventId) {
      setStepEventId(event?.id ?? null);
      setStep(initialStep(event));
    }
  }, [data.loading, event, stepEventId]);

  const nowIso = useCallback(() => now().toISOString(), [now]);

  const saveEvent = useCallback(
    async (next: WeekEvent) => {
      await repos.events.save(next);
      await reload();
    },
    [repos, reload],
  );

  /**
   * Applies a pure change to the CURRENT stored version of the open event.
   * Changes are queued, so fast taps (or an OCR result arriving later) never
   * overwrite each other.
   */
  const eventIdRef = useRef<string | undefined>(undefined);
  eventIdRef.current = event?.id;
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const mutateEvent = useCallback(
    (change: (latest: WeekEvent) => WeekEvent | null) => {
      const id = eventIdRef.current;
      if (!id) return Promise.resolve();
      const task = queue.current.then(async () => {
        // Another R4 may save between our read and write: re-read and reapply the change.
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
            e instanceof ConflictError
              ? 'Someone else changed this event at the same moment. The latest version was loaded – please redo your last change.'
              : `Could not save: ${e instanceof Error ? e.message : 'unknown error'}`,
            'error',
          );
        })
        .then(reload);
    },
    [repos, reload, notify],
  );

  // ---------- start / meta ----------
  const startNewEvent = useCallback(
    async (date: string) => {
      const created = createWeekEvent(newId(), date, nowIso());
      await saveEvent(created);
      setPollOcrIds(new Set());
      setAttendanceOcrIds(new Set());
      notify('New week started. Import the poll screenshot or tick the voters.', 'success');
    },
    [newId, nowIso, saveEvent, notify],
  );

  const changeDate = useCallback(
    async (date: string) => {
      await mutateEvent((e) => setEventDate(e, date, nowIso()));
    },
    [event, mutateEvent, nowIso],
  );

  const discardEvent = useCallback(async () => {
    if (!event) return;
    await repos.events.delete(event.id);
    await reload();
    notify('This week was discarded.', 'info');
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
    return [...members]
      .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
      .map((m) => ({
        memberId: m.id,
        name: m.name,
        power: m.power,
        activity: m.activity,
        registered: registered.has(m.id),
        fromOcr: pollOcrIds.has(m.id) || registered.get(m.id)?.source === 'ocr',
        inactive: !m.active,
        suspendedFor: remainingSuspension(m.id, suspensions),
      }));
  }, [members, event, pollOcrIds, suspensions]);

  const toggleRegistration = useCallback(
    async (memberId: string) => {
      if (!event || !isEditable(event)) return;
      await mutateEvent((e) =>
        isEditable(e) ? setRegistered(e, memberId, !e.registrations.some((r) => r.memberId === memberId), 'manual', nowIso()) : null,
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
      await repos.members.save(member);
      if (event && isEditable(event)) await mutateEvent((e) => setRegistered(e, member.id, true, 'manual', nowIso()));
      else await reload();
      notify(`${member.name} added to the roster and registered.`, 'success');
      return {};
    },
    [members, newId, nowIso, repos, event, mutateEvent, reload, notify],
  );

  const registeredCount = event?.registrations.length ?? 0;
  const cap = registrationCap(settings);
  const starters = starterCount(settings);

  // ---------- step 2: selection ----------
  const runWeeklySelection = useCallback(async () => {
    if (!event || !isEditable(event)) return;
    const result = runSelection({
      members,
      registrations: event.registrations,
      history: events.filter((e) => e.id !== event.id),
      suspensions,
      settings,
    });
    await mutateEvent((e) => applySelectionToEvent(e, result.assignments, settings, nowIso()));
    setStep(2);
    const { eligible } = result.summary;
    notify(
      eligible > cap
        ? `Selection done: ${eligible} eligible for ${cap} places – ${eligible - cap} not selected this week.`
        : `Selection done: all ${eligible} eligible applicants are in.`,
      'success',
    );
  }, [event, members, events, suspensions, settings, mutateEvent, nowIso, notify, cap]);

  const playerView = useCallback(
    (a: WeekEvent['assignments'][number]): PlayerView => {
      const m = memberById.get(a.memberId);
      return {
        memberId: a.memberId,
        name: m?.name ?? '(removed member)',
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

  const movePlayer = useCallback(
    async (memberId: string, to: Slot) => {
      if (!event || !isEditable(event)) return;
      await mutateEvent((e) => replaceAssignments(e, moveAssignment(e.assignments, memberId, to), nowIso()));
    },
    [event, mutateEvent, nowIso],
  );

  const swapPlayers = useCallback(
    async (a: string, b: string) => {
      if (!event || !isEditable(event)) return;
      await mutateEvent((e) => replaceAssignments(e, swapAssignments(e.assignments, a, b), nowIso()));
    },
    [event, mutateEvent, nowIso],
  );

  const keepPlanWithLateChanges = useCallback(async () => {
    if (!event || !isEditable(event)) return;
    await mutateEvent((e) => syncPlanWithRegistrations(e, nowIso()));
    notify('Plan updated: late registrations added as last substitutes.', 'success');
  }, [event, mutateEvent, nowIso, notify]);

  // ---------- step 3: lock ----------
  const planText = useMemo(() => (event ? buildPlanText(event, members) : ''), [event, members]);

  /** Opens attendance: freezes the lineup. Only offered once the event day has arrived (or when forced). */
  const eventOver = event ? isEventOver(event, toIsoDate(now())) : false;
  const startAttendance = useCallback(async () => {
    if (!event || event.status === 'registration') return;
    await mutateEvent((e) => lockEvent(e, nowIso()));
    setStep(4);
  }, [event, mutateEvent, nowIso]);

  /** Back to planning (e.g. attendance was opened too early); the lineup becomes editable again. */
  const unlockPlan = useCallback(async () => {
    if (!event) return;
    await mutateEvent((e) => unlockEvent(e, nowIso()));
    setStep(2);
  }, [event, mutateEvent, nowIso]);

  const copyPlan = useCallback(async () => {
    const ok = await copyText(planText);
    notify(ok ? 'Plan copied – paste it in the alliance chat.' : 'Could not copy automatically. Select the text and copy it.', ok ? 'success' : 'warning');
  }, [planText, notify]);

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
      setAttendanceOcrIds(new Set(ids));
      void mutateEvent((e) => (e.status === 'locked' ? markAttendedMany(e, ids, nowIso()) : null));
    },
    [mutateEvent, nowIso],
  );
  const attendanceOcr = useScreenshotOcr(lineupCandidates, onAttendanceMatched);

  /** User says "this unrecognised OCR line is X": remember the spelling and register X. */
  const assignUnmatched = useCallback(
    async (guess: string, memberId: string, target: 'poll' | 'attendance') => {
      const member = memberById.get(memberId);
      if (!member || !event) return;
      const updated = addAlias(member, guess, nowIso());
      if (updated !== member) await repos.members.save(updated);
      if (target === 'poll') {
        pollOcr.dismissUnmatched(guess);
        if (isEditable(event)) await mutateEvent((e) => setRegistered(e, memberId, true, 'ocr', nowIso()));
        else await reload();
      } else {
        attendanceOcr.dismissUnmatched(guess);
        await mutateEvent((e) => markAttendedMany(e, [memberId], nowIso()));
      }
      notify(`“${guess}” will be recognised as ${member.name} from now on.`, 'success');
    },
    [memberById, event, nowIso, repos, mutateEvent, reload, notify, pollOcr, attendanceOcr],
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
      if (event?.status !== 'locked') return;
      await mutateEvent((e) =>
        e.status === 'locked'
          ? setAttended(e, memberId, !(e.attendance.find((a) => a.memberId === memberId)?.attended ?? false), nowIso())
          : null,
      );
    },
    [event, mutateEvent, nowIso],
  );

  const setMemberNotified = useCallback(
    async (memberId: string, notified: boolean) => {
      if (event?.status !== 'locked') return;
      await mutateEvent((e) => setNotified(e, memberId, notified, nowIso()));
    },
    [event, mutateEvent, nowIso],
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
    });
    try {
      await repos.finaliseEvent(result.event, result.suspensions);
    } catch (e) {
      await reload();
      notify(
        e instanceof ConflictError
          ? 'Someone else changed this event while you were finalising. Review the latest attendance and finalise again.'
          : `Could not finalise: ${e instanceof Error ? e.message : 'unknown error'}`,
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
        ? `Event finalised. ${result.issued.length} no-show${result.issued.length === 1 ? '' : 's'} suspended for ${settings.suspensionEvents} events.`
        : 'Event finalised. No penalties this week.',
      'success',
    );
  }, [event, suspensions, settings, nowIso, newId, repos, reload, attendanceOcr, pollOcr, notify]);

  /** Loads one of the bundled sample screenshots (public/samples) to try OCR without a real screenshot. */
  const loadSample = useCallback(
    async (file: 'demo-poll.png' | 'demo-attendance.png') => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}samples/${file}`);
        if (!response.ok) throw new Error(String(response.status));
        return await response.blob();
      } catch {
        notify('Could not load the sample screenshot.', 'error');
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
    if (!previous) return null;
    const issued = suspensions.filter((s) => previous.suspensionIdsIssued.includes(s.id));
    return {
      label: previous.label,
      played: previous.attendance.filter((a) => a.attended).length,
      suspendedNames: issued.map((s) => memberById.get(s.memberId)?.name ?? '(removed member)'),
    };
  }, [previous, suspensions, memberById]);

  const unlockedSteps: Record<WizardStep, boolean> = {
    1: Boolean(event),
    2: Boolean(event && event.status !== 'registration'),
    3: Boolean(event && event.status !== 'registration'),
    4: event?.status === 'locked' || (event?.status === 'planned' && eventOver),
  };

  return {
    loading: data.loading,
    hasMembers: members.length > 0,
    event,
    editable: event ? isEditable(event) : false,
    defaultDate: toIsoDate(now()),
    previousSummary,
    settings,
    cap,
    starters,
    step,
    setStep,
    unlockedSteps,
    startNewEvent,
    changeDate,
    discardEvent,
    // step 1
    pollOcr,
    tryPollSample,
    registrationItems,
    registeredCount,
    toggleRegistration,
    clearAllRegistrations,
    assignUnmatched,
    quickAddMember,
    runWeeklySelection,
    // step 2
    board,
    drift,
    hasOverrides,
    movePlayer,
    swapPlayers,
    keepPlanWithLateChanges,
    // step 3
    planText,
    copyPlan,
    eventOver,
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
