import type { Assignment, Slot } from '@/models/Assignment';
import { SLOTS } from '@/models/Assignment';

const SLOT_LABEL: Record<Slot, string> = {
  core: 'Core',
  rotation: 'Rotation',
  substitute: 'Substitutes',
  notSelected: 'Not selected',
};

/** Re-numbers `order` inside each slot, keeping the current relative order. */
function renumber(assignments: Assignment[]): Assignment[] {
  const counters = new Map<Slot, number>();
  const sorted = [...assignments].sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot) || a.order - b.order);
  return sorted.map((a) => {
    const order = counters.get(a.slot) ?? 0;
    counters.set(a.slot, order + 1);
    return { ...a, order };
  });
}

/** Manual override: moves a player to the end of another slot. */
export function moveAssignment(assignments: readonly Assignment[], memberId: string, to: Slot): Assignment[] {
  const current = assignments.find((a) => a.memberId === memberId);
  if (!current || current.slot === to) return [...assignments];
  const endOrder = assignments.filter((a) => a.slot === to).reduce((max, a) => Math.max(max, a.order + 1), 0);
  return renumber(
    assignments.map((a) =>
      a.memberId === memberId
        ? { ...a, slot: to, order: endOrder, overridden: true, reason: `Moved to ${SLOT_LABEL[to]} by R4 (was: ${a.reason})` }
        : a,
    ),
  );
}

/** Manual override: two players exchange places (slot and position). */
export function swapAssignments(assignments: readonly Assignment[], memberA: string, memberB: string): Assignment[] {
  const a = assignments.find((x) => x.memberId === memberA);
  const b = assignments.find((x) => x.memberId === memberB);
  if (!a || !b || memberA === memberB) return [...assignments];
  return renumber(
    assignments.map((x) => {
      if (x.memberId === memberA) return { ...x, slot: b.slot, order: b.order, overridden: true, reason: `Swapped into ${SLOT_LABEL[b.slot]} by R4` };
      if (x.memberId === memberB) return { ...x, slot: a.slot, order: a.order, overridden: true, reason: `Swapped into ${SLOT_LABEL[a.slot]} by R4` };
      return x;
    }),
  );
}

/** Adds a late registration at the end of a slot (default: substitutes) without re-running the selection. */
export function addAssignment(
  assignments: readonly Assignment[],
  memberId: string,
  slot: Slot = 'substitute',
  reason = 'Late registration added by R4',
): Assignment[] {
  if (assignments.some((a) => a.memberId === memberId)) return [...assignments];
  const order = assignments.filter((a) => a.slot === slot).reduce((max, a) => Math.max(max, a.order + 1), 0);
  return renumber([...assignments, { memberId, slot, order, reason, overridden: true }]);
}

/** Removes a player from the plan (e.g. registration withdrawn). */
export function removeAssignment(assignments: readonly Assignment[], memberId: string): Assignment[] {
  return renumber(assignments.filter((a) => a.memberId !== memberId));
}

export function slotLabel(slot: Slot): string {
  return SLOT_LABEL[slot];
}

export function assignmentsBySlot(assignments: readonly Assignment[]): Record<Slot, Assignment[]> {
  const result: Record<Slot, Assignment[]> = { core: [], rotation: [], substitute: [], notSelected: [] };
  for (const a of assignments) result[a.slot].push(a);
  for (const slot of SLOTS) result[slot].sort((x, y) => x.order - y.order);
  return result;
}
