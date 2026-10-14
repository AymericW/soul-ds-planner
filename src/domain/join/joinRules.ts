import { EVENT_TIME_ZONE, JOIN_DEADLINE_DAYS_BEFORE, JOIN_DEADLINE_TIME } from '@/constants/events';
import { JOIN_CODE_ALPHABET, JOIN_CODE_LENGTH, JOIN_LIMITS } from '@/constants/rules';
import { addDays, dateInTimeZone, timeInTimeZone } from '@/helpers/dates';
import { formatPower } from '@/helpers/format';
import { cleanDisplayName, normaliseName } from '@/helpers/normalise';
import { JOIN_CHOICES, type JoinChoice, type JoinChoices, type JoinPowerOutcome } from '@/models/JoinRequest';
import type { Registration } from '@/models/Registration';
import type { Settings } from '@/models/Settings';
import { EVENT_SLOTS, type WeekEvent } from '@/models/WeekEvent';

/**
 * Rules of the public join page. The database functions in
 * supabase/migrations/0002_two_events_and_join.sql (and 0003_join_open_until_wednesday.sql) implement the same rules server side;
 * the in-memory repositories use these functions directly.
 */

export const NO_CHOICES: JoinChoices = Object.freeze({ A: 'none', B: 'none' }) as JoinChoices;

/** Codes are compared trimmed and case-insensitively. An empty stored code disables the page. */
export function joinCodeMatches(storedCode: string, given: string): boolean {
  const expected = storedCode.trim().toUpperCase();
  return expected.length > 0 && expected === given.trim().toUpperCase();
}

export function generateJoinCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) code += JOIN_CODE_ALPHABET[Math.floor(random() * JOIN_CODE_ALPHABET.length)] ?? 'X';
  return code;
}

/** Error message for a self-reported power, or null when acceptable. */
export function validateJoinPower(power: number | undefined): string | null {
  if (power === undefined || !Number.isFinite(power)) return 'Write your power like 152.3M or 152300000.';
  if (power < JOIN_LIMITS.powerMin || power > JOIN_LIMITS.powerMax) {
    return `Power must be between ${formatPower(JOIN_LIMITS.powerMin)} and ${formatPower(JOIN_LIMITS.powerMax)}.`;
  }
  return null;
}

/** Error message for the name typed in "I'm not in the list", or null. */
export function validateUnlistedName(raw: string): string | null {
  const name = cleanDisplayName(raw);
  if (normaliseName(name).length < JOIN_LIMITS.nameMinLength) return 'Write your in-game name.';
  if (name.length > JOIN_LIMITS.nameMaxLength) return `Names are at most ${JOIN_LIMITS.nameMaxLength} characters.`;
  return null;
}

/** Accepts only {A, B} with values none/play/sub (missing slots = none). Returns null when invalid. */
export function parseJoinChoices(raw: unknown): JoinChoices | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (Object.keys(record).some((k) => !(EVENT_SLOTS as readonly string[]).includes(k))) return null;
  const result = { ...NO_CHOICES };
  for (const slot of EVENT_SLOTS) {
    const value = record[slot] ?? 'none';
    if (!(JOIN_CHOICES as readonly unknown[]).includes(value)) return null;
    result[slot] = value as JoinChoice;
  }
  return result;
}

/**
 * Mapping between the join page and the registration model:
 *   play -> registered as a normal applicant (may become starter; if not picked, stays a substitute candidate)
 *   sub  -> registered with substituteOnly: true (never a starter)
 *   none -> not registered
 */
export function choiceOfRegistration(registration: Registration | undefined): JoinChoice {
  if (!registration) return 'none';
  return registration.substituteOnly ? 'sub' : 'play';
}

/**
 * Applies a player's choice for one event (idempotent: resubmitting updates the same registration).
 * play/sub replace any existing registration of the member (keeping its position in the list);
 * none removes it only when it was self-submitted, so a leader's registration is never undone.
 */
export function applyJoinChoice(event: WeekEvent, memberId: string, choice: JoinChoice, enteredPower: number, nowIso: string): WeekEvent {
  const index = event.registrations.findIndex((r) => r.memberId === memberId);
  const existing = index >= 0 ? event.registrations[index] : undefined;
  if (choice === 'none') {
    if (!existing || existing.source !== 'self') return event;
    return { ...event, registrations: event.registrations.filter((_, i) => i !== index), updatedAt: nowIso };
  }
  const registration: Registration = {
    memberId,
    source: 'self',
    ...(choice === 'sub' ? { substituteOnly: true } : {}),
    submittedAt: nowIso,
    enteredPower,
  };
  const registrations =
    index >= 0 ? event.registrations.map((r, i) => (i === index ? registration : r)) : [...event.registrations, registration];
  return { ...event, registrations, updatedAt: nowIso };
}

/**
 * Power rule for self-reported power: within [-drop%, +rise%] of the roster value it is applied
 * immediately; outside it waits for a leader (the roster is not changed). Equal = unchanged.
 * A member without a known power (0) accepts any value.
 */
export function evaluatePowerUpdate(currentPower: number, newPower: number, settings: Pick<Settings, 'powerDropTolerancePct' | 'powerRiseTolerancePct'>): JoinPowerOutcome {
  if (newPower === currentPower) return 'unchanged';
  if (!(currentPower > 0)) return 'applied';
  const low = currentPower * (1 - settings.powerDropTolerancePct / 100);
  const high = currentPower * (1 + settings.powerRiseTolerancePct / 100);
  return newPower >= low && newPower <= high ? 'applied' : 'pending';
}

/** Self-registration deadline of an event (yyyy-mm-dd Friday): Wednesday, 22:00 Paris time. */
export function joinDeadline(eventDate: string): { date: string; time: string } {
  return { date: addDays(eventDate, -JOIN_DEADLINE_DAYS_BEFORE), time: JOIN_DEADLINE_TIME };
}

/** Is `now` (Paris time) before the event's self-registration deadline? */
export function isBeforeJoinDeadline(eventDate: string, now: Date): boolean {
  const deadline = joinDeadline(eventDate);
  return `${dateInTimeZone(now, EVENT_TIME_ZONE)}T${timeInTimeZone(now, EVENT_TIME_ZONE)}` < `${deadline.date}T${deadline.time}`;
}

/**
 * Can a player still change their answer for this event? (Afterwards the leaders' data wins.)
 * Always while no selection has run; once it ran (planned, not yet published), until Wednesday 22:00
 * Paris time – the leaders see the late sign-ups and re-run the selection.
 */
export function isOpenForSelfRegistration(event: WeekEvent | undefined, now: Date): boolean {
  if (!event) return false;
  if (event.status === 'registration') return true;
  return event.status === 'planned' && isBeforeJoinDeadline(event.date, now);
}
