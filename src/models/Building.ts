/**
 * The Desert Storm buildings a team defends, in the order the strongest starters are placed
 * (Silo first, hospitals last).
 */
export const BUILDINGS = [
  'silo',
  'refinery1',
  'refinery2',
  'science',
  'info',
  'arsenal',
  'mercenary',
  'hospital1',
  'hospital2',
  'hospital3',
  'hospital4',
] as const;
export type BuildingId = (typeof BUILDINGS)[number];

/** Which building a starter defends (one entry per placed starter). */
export interface BuildingAssignment {
  memberId: string;
  building: BuildingId;
  /** Position inside the building (0-based). */
  order: number;
  /** True when an R4 moved the player manually. */
  overridden?: boolean;
}
