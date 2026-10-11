import type { JoinChoices, JoinRequest, JoinRoster, JoinSubmissionView, JoinSubmitResult } from '@/models/JoinRequest';
import type { Member } from '@/models/Member';
import type { PowerChange } from '@/models/PowerChange';
import type { Settings } from '@/models/Settings';
import type { Suspension } from '@/models/Suspension';
import type { WeekEvent } from '@/models/WeekEvent';

/**
 * Storage contracts. The app only talks to these interfaces; Supabase is the
 * production implementation (src/data/supabase) and an in-memory one serves
 * tests and local development. Another backend can be added by implementing the same
 * interfaces and wiring it in src/compositionRoot.ts. See docs/ARCHITECTURE.md.
 */

/** Thrown when an event was changed by someone else since it was read. Re-read and retry. */
export class ConflictError extends Error {
  constructor(message = 'This event was changed by someone else.') {
    super(message);
    this.name = 'ConflictError';
  }
}

export interface MemberRepository {
  list(): Promise<Member[]>;
  get(id: string): Promise<Member | undefined>;
  save(member: Member): Promise<void>;
  saveMany(members: readonly Member[]): Promise<void>;
  delete(id: string): Promise<void>;
  replaceAll(members: readonly Member[]): Promise<void>;
}

export interface EventRepository {
  list(): Promise<WeekEvent[]>;
  get(id: string): Promise<WeekEvent | undefined>;
  /**
   * Saves the event as last read via get()/list(). Throws ConflictError when another
   * user saved it in between (the caller re-reads and reapplies its change).
   */
  save(event: WeekEvent): Promise<void>;
  delete(id: string): Promise<void>;
  replaceAll(events: readonly WeekEvent[]): Promise<void>;
  /** Creates the missing Team A / Team B events of the upcoming Friday (idempotent, no cron needed). */
  ensureWeekEvents(): Promise<void>;
}

export interface SuspensionRepository {
  list(): Promise<Suspension[]>;
  saveMany(suspensions: readonly Suspension[]): Promise<void>;
  replaceAll(suspensions: readonly Suspension[]): Promise<void>;
}

export interface SettingsRepository {
  /** Returns stored settings merged over the defaults. */
  get(): Promise<Settings>;
  /** Saves everything EXCEPT the join code: a stale page can never re-enable or revert a rotated code. */
  save(settings: Settings): Promise<void>;
  /** Sets (or with '' disables) the join code. The only way to change it. */
  setJoinCode(code: string): Promise<void>;
}

/** Leaders only: unlisted players' join requests. */
export interface JoinRequestRepository {
  list(): Promise<JoinRequest[]>;
  save(request: JoinRequest): Promise<void>;
}

/** Leaders only: history of power changes (self-reported and leader edits). */
export interface PowerChangeRepository {
  list(): Promise<PowerChange[]>;
  saveMany(changes: readonly PowerChange[]): Promise<void>;
}

export type JoinErrorCode =
  | 'bad_code'
  | 'closed'
  | 'invalid_member'
  | 'invalid_power'
  | 'invalid_choices'
  | 'invalid_name'
  | 'rate_limited'
  | 'too_many_requests'
  | 'unavailable';

/** A refusal of the public join API (wrong code, registrations closed, limits…). */
export class JoinError extends Error {
  constructor(
    public readonly code: JoinErrorCode,
    message: string = code,
  ) {
    super(message);
    this.name = 'JoinError';
  }
}

/**
 * Public join page API, usable WITHOUT login. Every call checks the alliance join code.
 * Supabase: narrow SECURITY DEFINER functions (no table is readable by anonymous users).
 */
export interface JoinGateway {
  /** Active members (id + name only) and the open events of the upcoming Friday. */
  getRoster(code: string): Promise<JoinRoster>;
  /** What this member currently has for the upcoming Friday (to show their previous answer). */
  getSubmission(code: string, memberId: string): Promise<JoinSubmissionView>;
  /** Registers (or updates) the member for Team A / Team B and applies the power rule. */
  submit(code: string, memberId: string, power: number, choices: JoinChoices): Promise<JoinSubmitResult>;
  /** "I'm not in the list": stores a pending request for the leaders. */
  requestUnlisted(code: string, name: string, power: number, choices: JoinChoices): Promise<void>;
}

export interface Repositories {
  members: MemberRepository;
  events: EventRepository;
  suspensions: SuspensionRepository;
  settings: SettingsRepository;
  joinRequests: JoinRequestRepository;
  powerChanges: PowerChangeRepository;
  join: JoinGateway;
  /**
   * Saves the finalised event and replaces all suspensions in one atomic step.
   * `basedOn` is the suspension list the result was computed from: when the stored list changed
   * in between (e.g. the other event of the week was finalised meanwhile), ConflictError is thrown.
   */
  finaliseEvent(event: WeekEvent, suspensions: readonly Suspension[], basedOn: readonly Suspension[]): Promise<void>;
  /** Calls `listener` when another user (or tab) changed data. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
  /** Wipes everything (used by "Reset data" and backup restore). */
  clearAll(): Promise<void>;
}
