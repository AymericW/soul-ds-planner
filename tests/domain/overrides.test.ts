import { describe, expect, it } from 'vitest';
import { addAssignment, assignmentsBySlot, moveAssignment, swapAssignments } from '@/domain/selection/overrides';
import type { Assignment } from '@/models/Assignment';

const base: Assignment[] = [
  { memberId: 'a', slot: 'core', order: 0, reason: '' },
  { memberId: 'b', slot: 'core', order: 1, reason: '' },
  { memberId: 'c', slot: 'rotation', order: 0, reason: '' },
  { memberId: 'd', slot: 'substitute', order: 0, reason: '' },
];

describe('manual overrides', () => {
  it('moves a player to the end of another slot and renumbers', () => {
    const moved = assignmentsBySlot(moveAssignment(base, 'a', 'substitute'));
    expect(moved.core.map((x) => [x.memberId, x.order])).toEqual([['b', 0]]);
    expect(moved.substitute.map((x) => [x.memberId, x.order])).toEqual([['d', 0], ['a', 1]]);
    expect(moved.substitute[1]!.overridden).toBe(true);
  });

  it('swaps two players', () => {
    const swapped = assignmentsBySlot(swapAssignments(base, 'b', 'd'));
    expect(swapped.core.map((x) => x.memberId)).toEqual(['a', 'd']);
    expect(swapped.substitute.map((x) => x.memberId)).toEqual(['b']);
  });

  it('adds a late registration as last substitute once', () => {
    const added = addAssignment(addAssignment(base, 'e'), 'e');
    expect(assignmentsBySlot(added).substitute.map((x) => x.memberId)).toEqual(['d', 'e']);
  });
});
