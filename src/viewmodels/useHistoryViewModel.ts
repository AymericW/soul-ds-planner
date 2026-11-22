import { t } from '@/helpers/i18n';
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
  /** "Team A" / "Team B". */
  team: string;
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
          name: names.get(memberId) ?? t().common.removedMember,
          slot,
          attended: attendance.get(memberId)?.attended ?? false,
          notified: attendance.get(memberId)?.notified ?? false,
          suspended: suspendedIds.has(memberId),
        });
        const s = e.settingsSnapshot;
        return {
          id: e.id,
          label: e.label,
          team: t().events.team(e.slot ?? 'A'),
          date: e.date,
          status: e.status,
          registered: e.registrations.length,
          played: e.attendance.filter((a) => a.attended).length,
          groups: {
            core: slots.core.map((a) => player(a.memberId, 'core')),
            rotation: slots.rotation.map((a) => player(a.memberId, 'rotation')),
            substitute: slots.substitute.map((a) => player(a.memberId, 'substitute')),
          },
          notSelected: slots.notSelected.map((a) => names.get(a.memberId) ?? t().common.removedMember),
          penalties: issued.map((x) => t().history.penaltyLine(names.get(x.memberId) ?? t().common.removedMember, x.totalEvents)),
          rules: s
            ? t().history.rules(
                s.coreStarters,
                s.rotationStarters,
                s.substitutes,
                Math.round(s.weights.power * 100),
                Math.round(s.weights.activity * 100),
                s.suspensionEvents,
              )
            : null,
        };
      });
  }, [events, suspensions, names]);

  const activeSuspensions = useMemo<ActiveSuspensionView[]>(
    () =>
      suspensions
        .filter(isSuspensionActive)
        .map((s) => ({ id: s.id, name: names.get(s.memberId) ?? t().common.removedMember, remaining: s.remainingEvents, reason: s.reason }))
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
