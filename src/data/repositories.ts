import type { Member } from '@/models/Member';
import type { Settings } from '@/models/Settings';
import type { Suspension } from '@/models/Suspension';
import type { WeekEvent } from '@/models/WeekEvent';

/**
 * Storage contracts. The app only talks to these interfaces; IndexedDB is the
 * current implementation and a cloud implementation (Firestore, Supabase, a
 * REST API...) can be added by implementing the same interfaces and wiring it
 * in src/compositionRoot.ts. See docs/ARCHITECTURE.md.
 */
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
  /** Wipes everything (used by "Reset data" and backup restore). */
  clearAll(): Promise<void>;
}
