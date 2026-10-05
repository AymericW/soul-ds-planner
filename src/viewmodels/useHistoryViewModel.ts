import { useMemo, useState } from 'react';
import { compareEventsChronologically } from '@/domain/history/eventHistory';
import { isSuspensionActive } from '@/domain/penalties/suspensions';
import { assignmentsBySlot } from '@/domain/selection/overrides';
import type { Slot } from '@/models/Assignment';
import type { EventStatus } from '@/models/WeekEvent';
import { useAppData } from './useAppData';

export interface HistoryPlayer {
  memberId: string;
  name: string;
  slot: Slot;
  attended: boolean;
  notified: boolean;
  suspended: boolean;
}

export interface HistoryEventView {
  id: string;
  label: string;
  date: string;
  status: EventStatus;
  registered: number;
  played: number;
  groups: Record<Exclude<Slot, 'notSelected'>, HistoryPlayer[]>;
  notSelected: string[];
  penalties: string[];
  rules: string | null;
}

export interface ActiveSuspensionView {
  id: string;
  name: string;
  remaining: number;
  reason: string;
}

export function useHistoryViewModel() {
  const data = useAppData();
  const { members, events, suspensions } = data;
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const names = useMemo(() => new Map(members.map((m) => [m.id, m.name])), [members]);

  const history = useMemo<HistoryEventView[]>(() => {
    return [...events]
      .sort(compareEventsChronologically)
      .reverse()
      .map((e) => {
        const slots = assignmentsBySlot(e.assignments);
        const attendance = new Map(e.attendance.map((a) => [a.memberId, a]));
        const issued = suspensions.filter((s) => e.suspensionIdsIssued.includes(s.id));
        const suspendedIds = new Set(issued.map((s) => s.memberId));
        const player = (memberId: string, slot: Slot): HistoryPlayer => ({
          memberId,
          name: names.get(memberId) ?? '(removed member)',
          slot,
          attended: attendance.get(memberId)?.attended ?? false,
          notified: attendance.get(memberId)?.notified ?? false,
          suspended: suspendedIds.has(memberId),
        });
        const s = e.settingsSnapshot;
        return {
          id: e.id,
          label: e.label,
          date: e.date,
          status: e.status,
          registered: e.registrations.length,
          played: e.attendance.filter((a) => a.attended).length,
          groups: {
            core: slots.core.map((a) => player(a.memberId, 'core')),
            rotation: slots.rotation.map((a) => player(a.memberId, 'rotation')),
            substitute: slots.substitute.map((a) => player(a.memberId, 'substitute')),
          },
          notSelected: slots.notSelected.map((a) => names.get(a.memberId) ?? '(removed member)'),
          penalties: issued.map((x) => `${names.get(x.memberId) ?? '(removed member)'} – ${x.totalEvents} events`),
          rules: s
            ? `${s.coreStarters} core · ${s.rotationStarters} rotation · ${s.substitutes} subs · weights ${Math.round(s.weights.power * 100)}/${Math.round(s.weights.activity * 100)} · suspension ${s.suspensionEvents}`
            : null,
        };
      });
  }, [events, suspensions, names]);

  const activeSuspensions = useMemo<ActiveSuspensionView[]>(
    () =>
      suspensions
        .filter(isSuspensionActive)
        .map((s) => ({ id: s.id, name: names.get(s.memberId) ?? '(removed member)', remaining: s.remainingEvents, reason: s.reason }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [suspensions, names],
  );

  return {
    loading: data.loading,
    history,
    activeSuspensions,
    expandedId,
    toggleExpanded: (id: string) => setExpandedId((cur) => (cur === id ? null : id)),
  };
}
