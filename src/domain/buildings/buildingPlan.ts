import { BUILDING_INFO } from '@/constants/buildings';
import type { Assignment } from '@/models/Assignment';
import { isStarterSlot } from '@/models/Assignment';
import { BUILDINGS, type BuildingAssignment, type BuildingId } from '@/models/Building';
import type { Member } from '@/models/Member';

/** Total number of places on the buildings (20 with the default layout). */
export const BUILDING_PLACES = BUILDINGS.reduce((n, id) => n + BUILDING_INFO[id].capacity, 0);

/**
 * Starters ordered by strength for the building fill: core players first (strongest
 * first), then the rotation starters (strongest first). Unknown members count as 0 power.
 */
export function startersByStrength(assignments: readonly Assignment[], members: readonly Member[]): string[] {
  const power = new Map(members.map((m) => [m.id, m.power]));
  const rank = (a: Assignment) => (a.slot === 'core' ? 0 : 1);
  return assignments
    .filter((a) => isStarterSlot(a.slot))
    .sort((a, b) => rank(a) - rank(b) || (power.get(b.memberId) ?? 0) - (power.get(a.memberId) ?? 0) || a.order - b.order)
    .map((a) => a.memberId);
}

function renumber(plan: readonly BuildingAssignment[]): BuildingAssignment[] {
  const counters = new Map<BuildingId, number>();
  return [...plan]
    .sort((a, b) => BUILDINGS.indexOf(a.building) - BUILDINGS.indexOf(b.building) || a.order - b.order)
    .map((a) => {
      const order = counters.get(a.building) ?? 0;
      counters.set(a.building, order + 1);
      return { ...a, order };
    });
}

/** Places members (already ordered by strength) into the free places, Silo first. */
function fillFreePlaces(plan: readonly BuildingAssignment[], memberIds: readonly string[]): BuildingAssignment[] {
  const next = [...plan];
  const queue = [...memberIds];
  for (const building of BUILDINGS) {
    let used = next.filter((a) => a.building === building).length;
    while (used < BUILDING_INFO[building].capacity && queue.length > 0) {
      next.push({ memberId: queue.shift()!, building, order: used });
      used += 1;
    }
  }
  return renumber(next);
}

/**
 * Fills the buildings from the lineup: the strongest core players in the Silo, then the
 * refineries, the science centre, the information centre, the Arsenal, the mercenary
 * factory, and everyone else in the hospitals. Starters beyond the places stay unplaced.
 */
export function autoFillBuildings(assignments: readonly Assignment[], members: readonly Member[]): BuildingAssignment[] {
  return fillFreePlaces([], startersByStrength(assignments, members));
}

/**
 * The plan to show for an event: a fresh auto-fill while no R4 touched it, otherwise the
 * stored plan brought in line with the lineup (players who are no longer starters are
 * dropped, new starters take the free places, Silo first).
 */
export function reconcileBuildingPlan(
  stored: readonly BuildingAssignment[] | undefined,
  assignments: readonly Assignment[],
  members: readonly Member[],
): BuildingAssignment[] {
  if (!stored || !stored.some((a) => a.overridden)) return autoFillBuildings(assignments, members);
  const starters = startersByStrength(assignments, members);
  const starterSet = new Set(starters);
  const kept = renumber(stored.filter((a) => starterSet.has(a.memberId)));
  const placed = new Set(kept.map((a) => a.memberId));
  return fillFreePlaces(
    kept,
    starters.filter((id) => !placed.has(id)),
  );
}

export function buildingHasRoom(plan: readonly BuildingAssignment[], building: BuildingId): boolean {
  return plan.filter((a) => a.building === building).length < BUILDING_INFO[building].capacity;
}

/** Manual move to a building with a free place (unchanged when the building is full). */
export function moveToBuilding(plan: readonly BuildingAssignment[], memberId: string, building: BuildingId): BuildingAssignment[] {
  const current = plan.find((a) => a.memberId === memberId);
  if (current?.building === building || !buildingHasRoom(plan, building)) return [...plan];
  const order = plan.filter((a) => a.building === building).length;
  return renumber([...plan.filter((a) => a.memberId !== memberId), { memberId, building, order, overridden: true }]);
}

/**
 * Two players exchange places. One of them may be unplaced (not in the plan): they take the
 * other's place and that player becomes unplaced.
 */
export function swapBuildings(plan: readonly BuildingAssignment[], memberA: string, memberB: string): BuildingAssignment[] {
  if (memberA === memberB) return [...plan];
  const a = plan.find((x) => x.memberId === memberA);
  const b = plan.find((x) => x.memberId === memberB);
  if (!a && !b) return [...plan];
  const rest = plan.filter((x) => x.memberId !== memberA && x.memberId !== memberB);
  const next = [...rest];
  if (b) next.push({ ...b, memberId: memberA, overridden: true });
  if (a) next.push({ ...a, memberId: memberB, overridden: true });
  return renumber(next);
}

export function buildingsById(plan: readonly BuildingAssignment[]): Record<BuildingId, BuildingAssignment[]> {
  const result = Object.fromEntries(BUILDINGS.map((id) => [id, [] as BuildingAssignment[]])) as Record<BuildingId, BuildingAssignment[]>;
  for (const a of plan) result[a.building].push(a);
  for (const id of BUILDINGS) result[id].sort((x, y) => x.order - y.order);
  return result;
}

/** Starters without a place (more starters than places, or removed by a swap). */
export function unplacedStarters(plan: readonly BuildingAssignment[], assignments: readonly Assignment[], members: readonly Member[]): string[] {
  const placed = new Set(plan.map((a) => a.memberId));
  return startersByStrength(assignments, members).filter((id) => !placed.has(id));
}

export function hasBuildingOverrides(plan: readonly BuildingAssignment[]): boolean {
  return plan.some((a) => a.overridden);
}
