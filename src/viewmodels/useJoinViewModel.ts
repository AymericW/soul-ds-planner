import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EVENT_SLOT_INFO } from '@/constants/events';
import { JoinError, type JoinErrorCode } from '@/data/repositories';
import { NO_CHOICES, validateJoinPower, validateUnlistedName } from '@/domain/join/joinRules';
import { formatEventDate } from '@/helpers/dates';
import { parsePower } from '@/helpers/format';
import { normaliseName } from '@/helpers/normalise';
import type { JoinChoice, JoinChoices, JoinPowerOutcome, JoinRoster, JoinSubmissionView } from '@/models/JoinRequest';
import { EVENT_SLOTS, type EventSlot } from '@/models/WeekEvent';
import { useAppServices } from './AppServicesContext';
import { readHashParams } from './useNavigationViewModel';

const ERROR_MESSAGES: Record<JoinErrorCode, string> = {
  bad_code: 'This join link or code is not valid (any more). Ask an R4 for the current link.',
  closed: 'Registrations for this event are closed: the leaders have already planned it. Contact an R4 if something changed.',
  invalid_member: 'This name is not in the active roster (any more). Use “I’m not in the list”.',
  invalid_power: 'This power looks wrong. Write it like 152.3M or 152300000.',
  invalid_choices: 'Choose “Not available”, “Play” or “Sub only” for each event.',
  invalid_name: 'Write your in-game name (2 to 32 characters).',
  rate_limited: 'Too many attempts. Wait a few minutes and try again.',
  too_many_requests: 'There are too many open requests right now. Please contact an R4 directly.',
  unavailable: 'The server could not be reached. Check your connection and try again.',
};

const messageOf = (e: unknown) => ERROR_MESSAGES[e instanceof JoinError ? e.code : 'unavailable'];

export type JoinPhase = 'enterCode' | 'loading' | 'badCode' | 'ready';

export type JoinResult =
  | { kind: 'registered'; name: string; power: JoinPowerOutcome; choices: JoinChoices }
  | { kind: 'requested'; name: string };

export interface JoinEventView {
  slot: EventSlot;
  team: string;
  timeLabel: string;
  dateLabel: string;
  open: boolean;
}

/** Public join page (no login): players register themselves for Team A and/or Team B. */
export function useJoinViewModel() {
  const { repos } = useAppServices();
  const initialCode = useRef(readHashParams().get('code')?.trim() ?? '');
  const [code, setCode] = useState(initialCode.current);
  const [codeInput, setCodeInput] = useState(initialCode.current);
  const [phase, setPhase] = useState<JoinPhase>(initialCode.current ? 'loading' : 'enterCode');
  const [roster, setRoster] = useState<JoinRoster | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'member' | 'unlisted'>('member');
  const [search, setSearch] = useState('');
  const [memberId, setMemberId] = useState<string | null>(null);
  const [previous, setPrevious] = useState<JoinSubmissionView | null>(null);
  const [unlistedName, setUnlistedName] = useState('');
  const [powerText, setPowerText] = useState('');
  const [choices, setChoices] = useState<JoinChoices>({ ...NO_CHOICES });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<JoinResult | null>(null);

  const load = useCallback(
    async (value: string) => {
      setPhase('loading');
      setError(null);
      try {
        const data = await repos.join.getRoster(value);
        setRoster(data);
        setCode(value);
        setPhase('ready');
      } catch (e) {
        setRoster(null);
        if (e instanceof JoinError && e.code === 'bad_code') setPhase('badCode');
        else {
          setPhase('enterCode');
          setError(messageOf(e));
        }
      }
    },
    [repos],
  );

  useEffect(() => {
    if (initialCode.current) void load(initialCode.current);
  }, [load]);

  const submitCode = useCallback(() => {
    const value = codeInput.trim().toUpperCase();
    if (!value) return;
    try {
      window.history.replaceState(null, '', `#/join?code=${encodeURIComponent(value)}`);
    } catch {
      /* keeping the code in the address bar is only a convenience */
    }
    void load(value);
  }, [codeInput, load]);

  const events = useMemo<JoinEventView[]>(
    () =>
      EVENT_SLOTS.map((slot) => {
        const e = roster?.events.find((x) => x.slot === slot);
        return {
          slot,
          team: EVENT_SLOT_INFO[slot].team,
          timeLabel: EVENT_SLOT_INFO[slot].timeLabel,
          dateLabel: e ? formatEventDate(e.date) : '',
          open: e?.status === 'registration',
        };
      }),
    [roster],
  );
  const anyOpen = events.some((e) => e.open);

  const matches = useMemo(() => {
    const q = normaliseName(search);
    const list = roster?.members ?? [];
    return q ? list.filter((m) => normaliseName(m.name).includes(q)) : list;
  }, [roster, search]);

  const member = roster?.members.find((m) => m.id === memberId) ?? null;

  const pickMember = useCallback(
    async (id: string | null) => {
      setMemberId(id);
      setPrevious(null);
      setChoices({ ...NO_CHOICES });
      setError(null);
      if (!id) return;
      try {
        const view = await repos.join.getSubmission(code, id);
        setPrevious(view);
        setChoices(view.choices);
      } catch (e) {
        setError(messageOf(e));
      }
    },
    [repos, code],
  );

  const setChoice = useCallback((slot: EventSlot, choice: JoinChoice) => setChoices((c) => ({ ...c, [slot]: choice })), []);

  const power = parsePower(powerText);
  const powerError = powerText.trim() ? validateJoinPower(power) : null;
  const nameError = mode === 'unlisted' && unlistedName.trim() ? validateUnlistedName(unlistedName) : null;
  // Closed events are sent as "none": the server ignores that, so the leaders' data for them is kept.
  const sentChoices = useMemo<JoinChoices>(() => {
    const result = { ...choices };
    for (const e of events) if (!e.open) result[e.slot] = 'none';
    return result;
  }, [choices, events]);
  const choosesSomething = EVENT_SLOTS.some((s) => sentChoices[s] !== 'none');
  const hadSomething = Boolean(previous && EVENT_SLOTS.some((s) => previous.choices[s] !== 'none'));
  const canSubmit =
    !submitting &&
    power !== undefined &&
    !validateJoinPower(power) &&
    (mode === 'member' ? Boolean(memberId) && (choosesSomething || hadSomething) : !validateUnlistedName(unlistedName) && choosesSomething);

  const submit = useCallback(async () => {
    if (!canSubmit || power === undefined) return;
    setSubmitting(true);
    setError(null);
    try {
      if (mode === 'member' && member) {
        const res = await repos.join.submit(code, member.id, power, sentChoices);
        setResult({ kind: 'registered', name: member.name, power: res.power, choices: res.choices });
      } else {
        await repos.join.requestUnlisted(code, unlistedName, power, sentChoices);
        setResult({ kind: 'requested', name: unlistedName.trim() });
      }
    } catch (e) {
      setError(messageOf(e));
      if (e instanceof JoinError && e.code === 'closed') {
        // Refresh which events are still open.
        try {
          setRoster(await repos.join.getRoster(code));
        } catch {
          /* the error above is already shown */
        }
      }
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, power, mode, member, repos, code, sentChoices, unlistedName]);

  /** Back to the form (e.g. to change the answer). */
  const startOver = useCallback(() => {
    setResult(null);
    if (memberId) void pickMember(memberId);
  }, [memberId, pickMember]);

  return {
    phase,
    error,
    codeInput,
    setCodeInput,
    submitCode,
    events,
    anyOpen,
    mode,
    setMode,
    search,
    setSearch,
    matches,
    member,
    pickMember,
    previous,
    unlistedName,
    setUnlistedName,
    nameError,
    powerText,
    setPowerText,
    powerError,
    choices,
    setChoice,
    canSubmit,
    submitting,
    submit,
    result,
    startOver,
  };
}

export type JoinViewModel = ReturnType<typeof useJoinViewModel>;
