import type { Member } from '@/models/Member';
import type { Settings } from '@/models/Settings';
import type { Suspension } from '@/models/Suspension';
import type { WeekEvent } from '@/models/WeekEvent';

/**
 * Storage contracts. The app only talks to these interfaces; Supabase is the
 * production implementation (src/data/supabase) and an in-memory one serves
 * tests. Another backend can be added by implementing the same interfaces and
 * wiring it in src/compositionRoot.ts. See docs/ARCHITECTURE.md.
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
}

export interface SuspensionRepository {
  list(): Promise<Suspension[]>;
  saveMany(suspensions: readonly Suspension[]): Promise<void>;
  replaceAll(suspensions: readonly Suspension[]): Promise<void>;
}

export interface SettingsRepository {
  /** Returns stored settings merged over the defaults. */
  get(): Promise<Settings>;
  save(settings: Settings): Promise<void>;
}

export interface Repositories {
  members: MemberRepository;
  events: EventRepository;
  suspensions: SuspensionRepository;
  settings: SettingsRepository;
  /** Saves the finalised event and replaces all suspensions in one atomic step. */
  finaliseEvent(event: WeekEvent, suspensions: readonly Suspension[]): Promise<void>;
  /** Calls `listener` when another user (or tab) changed data. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
  /** Wipes everything (used by "Reset data" and backup restore). */
  clearAll(): Promise<void>;
}
