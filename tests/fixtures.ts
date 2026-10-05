import type { Assignment, Slot } from '@/models/Assignment';
import type { Attendance } from '@/models/Attendance';
import type { Member } from '@/models/Member';
import type { Settings } from '@/models/Settings';
import type { Suspension } from '@/models/Suspension';
import type { WeekEvent } from '@/models/WeekEvent';
import { DEFAULT_SETTINGS } from '@/constants/defaults';

const T0 = '2026-01-01T00:00:00.000Z';

export function makeMember(partial: Partial<Member> & { id: string }): Member {
  return {
    name: partial.id.toUpperCase(),
    aliases: [],
    power: 100_000_000,
    activity: 3,
    active: true,
    createdAt: T0,
    updatedAt: T0,
    ...partial,
  };
}

export function makeSettings(partial: Partial<Settings> = {}): Settings {
  return { ...DEFAULT_SETTINGS, weights: { ...DEFAULT_SETTINGS.weights }, ...partial };
}

/**
 * Builds a finalised event. `lineup` maps memberId -> slot; `attended` lists who entered.
 */
export function makeFinalisedEvent(
  id: string,
  date: string,
  lineup: Record<string, Slot>,
  attended: string[],
  notified: string[] = [],
): WeekEvent {
  const assignments: Assignment[] = Object.entries(lineup).map(([memberId, slot], order) => ({
    memberId,
    slot,
    order,
    reason: 'fixture',
  }));
  const attendance: Attendance[] = Object.keys(lineup)
    .filter((memberId) => lineup[memberId] !== 'notSelected')
    .map((memberId) => ({ memberId, attended: attended.includes(memberId), notified: notified.includes(memberId) }));
  return {
    id,
    label: id,
    date,
    status: 'finalised',
    registrations: Object.keys(lineup).map((memberId) => ({ memberId, source: 'manual' as const })),
    assignments,
    attendance,
    suspensionIdsIssued: [],
    createdAt: `${date}T10:00:00.000Z`,
    updatedAt: `${date}T10:00:00.000Z`,
    finalisedAt: `${date}T20:00:00.000Z`,
  };
}

export function makeSuspension(partial: Partial<Suspension> & { id: string; memberId: string }): Suspension {
  return {
    sourceEventId: 'e0',
    createdAt: T0,
    totalEvents: 2,
    remainingEvents: 2,
    reason: 'fixture',
    ...partial,
  };
}
