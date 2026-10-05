export const SLOTS = ['core', 'rotation', 'substitute', 'notSelected'] as const;
export type Slot = (typeof SLOTS)[number];

export type StarterSlot = Extract<Slot, 'core' | 'rotation'>;

export function isStarterSlot(slot: Slot): slot is StarterSlot {
  return slot === 'core' || slot === 'rotation';
}

/** Where a registered member ended up in the weekly plan, and why. */
export interface Assignment {
  memberId: string;
  slot: Slot;
  /** Position within the slot (0-based). */
  order: number;
  /** Short human readable explanation. */
  reason: string;
  /** Relative score used for the core ranking (0-1), when computed. */
  score?: number;
  /** True when an R4 moved the player manually. */
  overridden?: boolean;
}
