import { defaultEventLabel } from '@/helpers/dates';
import type { Assignment } from '@/models/Assignment';
import type { Attendance } from '@/models/Attendance';
import type { RegistrationSource } from '@/models/Registration';
import type { Settings } from '@/models/Settings';
import type { WeekEvent } from '@/models/WeekEvent';
import { compareEventsChronologically } from '@/domain/history/eventHistory';
import { addAssignment, removeAssignment } from '@/domain/selection/overrides';

export function createWeekEvent(id: string, date: string, nowIso: string): WeekEvent {
  return {
    id,
    label: defaultEventLabel(date),
    date,
    status: 'registration',
    registrations: [],
    assignments: [],
    attendance: [],
    suspensionIdsIssued: [],
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

/** The event being prepared (the most recent one that is not finalised), if any. */
export function currentOpenEvent(events: readonly WeekEvent[]): WeekEvent | undefined {
  return [...events].filter((e) => e.status !== 'finalised').sort(compareEventsChronologically).pop();
}

export function lastFinalisedEvent(events: readonly WeekEvent[]): WeekEvent | undefined {
  return [...events].filter((e) => e.status === 'finalised').sort(compareEventsChronologically).pop();
}

export function isEditable(event: WeekEvent): boolean {
  return event.status === 'registration' || event.status === 'planned';
}

export function setEventDate(event: WeekEvent, date: string, nowIso: string): WeekEvent {
  return { ...event, date, label: defaultEventLabel(date), updatedAt: nowIso };
}

export function setRegistered(
  event: WeekEvent,
  memberId: string,
  registered: boolean,
  source: RegistrationSource,
  nowIso: string,
): WeekEvent {
  const has = event.registrations.some((r) => r.memberId === memberId);
  if (has === registered) return event;
  const registrations = registered
    ? [...event.registrations, { memberId, source }]
    : event.registrations.filter((r) => r.memberId !== memberId);
  return { ...event, registrations, updatedAt: nowIso };
}

/** Adds several registrations at once (e.g. OCR auto-ticks); existing ones are kept as they are. */
export function addRegistrations(event: WeekEvent, memberIds: readonly string[], source: RegistrationSource, nowIso: string): WeekEvent {
  const existing = new Set(event.registrations.map((r) => r.memberId));
  const added = [...new Set(memberIds)].filter((id) => !existing.has(id)).map((memberId) => ({ memberId, source }));
  if (added.length === 0) return event;
  return { ...event, registrations: [...event.registrations, ...added], updatedAt: nowIso };
}

export function clearRegistrations(event: WeekEvent, nowIso: string): WeekEvent {
  return { ...event, registrations: [], updatedAt: nowIso };
}

export function applySelectionToEvent(event: WeekEvent, assignments: Assignment[], settings: Settings, nowIso: string): WeekEvent {
  return { ...event, status: 'planned', assignments, settingsSnapshot: settings, attendance: [], updatedAt: nowIso };
}

export function replaceAssignments(event: WeekEvent, assignments: Assignment[], nowIso: string): WeekEvent {
  return { ...event, assignments, updatedAt: nowIso };
}

/** Registrations changed after the selection ran: who is new, who withdrew. */
export function registrationDrift(event: WeekEvent): { lateAdds: string[]; withdrawn: string[] } {
  if (event.status === 'registration') return { lateAdds: [], withdrawn: [] };
  const registered = new Set(event.registrations.map((r) => r.memberId));
  const assigned = new Set(event.assignments.map((a) => a.memberId));
  return {
    lateAdds: [...registered].filter((id) => !assigned.has(id)),
    withdrawn: [...assigned].filter((id) => !registered.has(id)),
  };
}

/** Keeps the current plan: late registrations become the last substitutes, withdrawn players are removed. */
export function syncPlanWithRegistrations(event: WeekEvent, nowIso: string): WeekEvent {
  const { lateAdds, withdrawn } = registrationDrift(event);
  let assignments = event.assignments;
  for (const id of withdrawn) assignments = removeAssignment(assignments, id);
  for (const id of lateAdds) assignments = addAssignment(assignments, id);
  return { ...event, assignments, updatedAt: nowIso };
}

export function lockEvent(event: WeekEvent, nowIso: string): WeekEvent {
  if (event.status !== 'planned') return event;
  return { ...event, status: 'locked', updatedAt: nowIso };
}

export function unlockEvent(event: WeekEvent, nowIso: string): WeekEvent {
  if (event.status !== 'locked') return event;
  return { ...event, status: 'planned', updatedAt: nowIso };
}

function upsertAttendance(list: readonly Attendance[], memberId: string, patch: Partial<Attendance>): Attendance[] {
  const current = list.find((a) => a.memberId === memberId) ?? { memberId, attended: false, notified: false };
  const next = { ...current, ...patch };
  if (next.attended) next.notified = false;
  return [...list.filter((a) => a.memberId !== memberId), next];
}

export function setAttended(event: WeekEvent, memberId: string, attended: boolean, nowIso: string): WeekEvent {
  return { ...event, attendance: upsertAttendance(event.attendance, memberId, { attended }), updatedAt: nowIso };
}

export function markAttendedMany(event: WeekEvent, memberIds: readonly string[], nowIso: string): WeekEvent {
  const lineup = new Set(event.assignments.filter((a) => a.slot !== 'notSelected').map((a) => a.memberId));
  let attendance = event.attendance;
  for (const id of memberIds) if (lineup.has(id)) attendance = upsertAttendance(attendance, id, { attended: true });
  return { ...event, attendance, updatedAt: nowIso };
}

export function setNotified(event: WeekEvent, memberId: string, notified: boolean, nowIso: string): WeekEvent {
  return { ...event, attendance: upsertAttendance(event.attendance, memberId, { notified }), updatedAt: nowIso };
}
