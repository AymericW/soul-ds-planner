import type { EventSlot, EventStatus } from './WeekEvent';

/** What a player answers for one event on the join page. */
export const JOIN_CHOICES = ['none', 'play', 'sub'] as const;
export type JoinChoice = (typeof JOIN_CHOICES)[number];
export type JoinChoices = Record<EventSlot, JoinChoice>;

export type JoinRequestStatus = 'pending' | 'approved' | 'rejected';

/** "I'm not in the list": a player unknown to the roster asks to be added and registered. */
export interface JoinRequest {
  id: string;
  status: JoinRequestStatus;
  /** Name as typed by the player. */
  name: string;
  /** normaliseName(name), used to merge repeated requests. */
  normalisedName: string;
  power: number;
  choices: JoinChoices;
  /** Friday the request was made for (yyyy-mm-dd). */
  weekDate: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  /** Display name / email of the leader who resolved it. */
  resolvedBy?: string;
  linkedMemberId?: string;
}

/** Public, minimal view of the roster for the join page (never power or activity). */
export interface JoinRosterEntry {
  id: string;
  name: string;
}

export interface JoinOpenEvent {
  id: string;
  slot: EventSlot;
  date: string;
  status: EventStatus;
}

export interface JoinRoster {
  members: JoinRosterEntry[];
  events: JoinOpenEvent[];
}

/** What the member currently has for the week's events (shown when they come back). */
export interface JoinSubmissionView {
  choices: JoinChoices;
  /** Latest self-submission time, if any. */
  submittedAt?: string;
}

export type JoinPowerOutcome = 'applied' | 'pending' | 'unchanged';

export interface JoinSubmitResult {
  power: JoinPowerOutcome;
  choices: JoinChoices;
}
