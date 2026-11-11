import { describe, expect, it } from 'vitest';
import { buildBuildingImageContent, buildingImageFileName, squadPhases } from '@/domain/buildings/buildingImageContent';
import {
  BUILDING_PLACES,
  autoFillBuildings,
  buildingHasRoom,
  buildingsById,
  moveToBuilding,
  reconcileBuildingPlan,
  startersByStrength,
  swapBuildings,
  unplacedStarters,
} from '@/domain/buildings/buildingPlan';
import { applySelectionToEvent, resetBuildingPlan, setBuildingPlan } from '@/domain/events/eventLifecycle';
import { createWeekEvent } from '@/domain/events/weekEvents';
import type { Assignment } from '@/models/Assignment';
import { makeMember, makeSettings } from '../fixtures';

const T = '2026-11-10T10:00:00.000Z';

/** 12 core (c1 strongest) + 8 rotation (r1 strongest) + 2 subs. */
const members = [
  ...Array.from({ length: 12 }, (_, i) => makeMember({ id: `c${i + 1}`, power: 200 - i })),
  ...Array.from({ length: 8 }, (_, i) => makeMember({ id: `r${i + 1}`, power: 100 - i })),
  makeMember({ id: 's1', power: 300 }),
  makeMember({ id: 's2', power: 10 }),
];
const lineup: Assignment[] = [
  // Core is stored in score order, not power order, so the fill must sort by power itself.
  ...Array.from({ length: 12 }, (_, i) => ({ memberId: `c${12 - i}`, slot: 'core' as const, order: i, reason: '' })),
  ...Array.from({ length: 8 }, (_, i) => ({ memberId: `r${i + 1}`, slot: 'rotation' as const, order: i, reason: '' })),
  { memberId: 's1', slot: 'substitute', order: 0, reason: '' },
  { memberId: 's2', slot: 'substitute', order: 1, reason: '' },
];

describe('building auto-fill', () => {
  it('orders core players by power before rotation players by power', () => {
    const ids = startersByStrength(lineup, members);
    expect(ids.slice(0, 3)).toEqual(['c1', 'c2', 'c3']);
    expect(ids[11]).toBe('c12');
    expect(ids.slice(12)).toEqual(['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8']);
    expect(ids).not.toContain('s1');
  });

  it('puts the strongest in the Silo, then refineries, science, info, arsenal, factory, hospitals', () => {
    const by = buildingsById(autoFillBuildings(lineup, members));
    expect(by.silo.map((a) => a.memberId)).toEqual(['c1', 'c2']);
    expect(by.refinery1.map((a) => a.memberId)).toEqual(['c3', 'c4']);
    expect(by.refinery2.map((a) => a.memberId)).toEqual(['c5', 'c6']);
    expect(by.science.map((a) => a.memberId)).toEqual(['c7', 'c8']);
    expect(by.info.map((a) => a.memberId)).toEqual(['c9', 'c10']);
    expect(by.arsenal.map((a) => a.memberId)).toEqual(['c11']);
    expect(by.mercenary.map((a) => a.memberId)).toEqual(['c12']);
    expect(by.hospital1.map((a) => a.memberId)).toEqual(['r1', 'r2']);
    expect(by.hospital4.map((a) => a.memberId)).toEqual(['r7', 'r8']);
    expect(BUILDING_PLACES).toBe(20);
  });

  it('leaves buildings empty with fewer starters and starters unplaced with more', () => {
    const few = lineup.slice(0, 3);
    const plan = autoFillBuildings(few, members);
    expect(plan).toHaveLength(3);
    expect(buildingsById(plan).refinery1).toHaveLength(1);
    expect(buildingHasRoom(plan, 'refinery1')).toBe(true);

    const extra: Assignment[] = [...lineup.filter((a) => a.memberId !== 's1'), { memberId: 's1', slot: 'rotation', order: 8, reason: '' }];
    const big = autoFillBuildings(extra, members);
    expect(big).toHaveLength(20);
    // s1 is the strongest rotation player, so the weakest rotation player is the one left out.
    expect(unplacedStarters(big, extra, members)).toEqual(['r8']);
  });
});

describe('building overrides', () => {
  const plan = autoFillBuildings(lineup, members);

  it('moves a player to a building with room and marks the move as manual', () => {
    const moved = moveToBuilding(plan.filter((a) => a.memberId !== 'r8'), 'c1', 'hospital4');
    const by = buildingsById(moved);
    expect(by.silo.map((a) => a.memberId)).toEqual(['c2']);
    expect(by.hospital4.map((a) => [a.memberId, a.order, a.overridden])).toEqual([['r7', 0, undefined], ['c1', 1, true]]);
  });

  it('refuses a move into a full building', () => {
    expect(moveToBuilding(plan, 'c1', 'hospital4')).toEqual(plan);
  });

  it('swaps two players, also with an unplaced one', () => {
    const by = buildingsById(swapBuildings(plan, 'c1', 'r8'));
    expect(by.silo.map((a) => a.memberId)).toEqual(['r8', 'c2']);
    expect(by.hospital4.map((a) => a.memberId)).toEqual(['r7', 'c1']);

    const withUnplaced = swapBuildings(plan, 'c1', 'x');
    expect(buildingsById(withUnplaced).silo.map((a) => a.memberId)).toEqual(['x', 'c2']);
    expect(withUnplaced.some((a) => a.memberId === 'c1')).toBe(false);
  });

  it('keeps the manual plan in line with the lineup', () => {
    const manual = swapBuildings(plan, 'c1', 'r8');
    // c2 leaves the lineup, a new starter n1 arrives: n1 takes the free Silo place, c2 is dropped.
    const changed: Assignment[] = [
      ...lineup.filter((a) => a.memberId !== 'c2'),
      { memberId: 'n1', slot: 'rotation', order: 8, reason: '' },
    ];
    const by = buildingsById(reconcileBuildingPlan(manual, changed, [...members, makeMember({ id: 'n1', power: 1 })]));
    expect(by.silo.map((a) => a.memberId)).toEqual(['r8', 'n1']);
    expect(by.hospital4.map((a) => a.memberId)).toEqual(['r7', 'c1']);
  });

  it('re-fills from scratch while nothing was moved by hand', () => {
    const stale = autoFillBuildings(lineup.slice(0, 2), members);
    expect(reconcileBuildingPlan(stale, lineup, members)).toEqual(plan);
    expect(reconcileBuildingPlan(undefined, lineup, members)).toEqual(plan);
  });
});

describe('building image content', () => {
  const event = { ...createWeekEvent('2026-11-13', 'B', T), status: 'planned' as const, assignments: lineup };
  const plan = autoFillBuildings(lineup, members);

  it('fills the squad names from the Silo, Arsenal and mercenary factory', () => {
    const phases = squadPhases(plan, (id) => id.toUpperCase());
    expect(phases[0]!.directives.map((d) => d.names)).toEqual([['C11'], ['C1', 'C2'], ['C12']]);
    expect(phases[1]!.directives.map((d) => d.names)).toEqual([['C1', 'C2'], ['C11', 'C12']]);
  });

  it('resolves names, substitutes in call-in order and the team label', () => {
    const content = buildBuildingImageContent(event, plan, members);
    expect(content.team).toBe('ÉQUIPE B');
    expect(content.buildings.find((b) => b.id === 'silo')?.names).toEqual(['C1', 'C2']);
    expect(content.buildings.find((b) => b.id === 'arsenal')?.label).toBe('Arsenal');
    expect(content.substitutes).toEqual(['S1', 'S2']);
    expect(buildingImageFileName(event)).toBe('tempete-du-desert-equipe-B-2026-11-13.png');
  });

  it('is stored on the event and dropped by a re-run or a reset', () => {
    const stored = setBuildingPlan(event, swapBuildings(plan, 'c1', 'r8'), T);
    expect(stored.buildings?.some((a) => a.overridden)).toBe(true);
    expect(applySelectionToEvent(stored, lineup, makeSettings(), T).buildings).toBeUndefined();
    expect(resetBuildingPlan(stored, T).buildings).toBeUndefined();
    expect(resetBuildingPlan(event, T)).toBe(event);
  });
});
