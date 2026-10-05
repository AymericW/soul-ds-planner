import type { Candidate } from './candidates';
import { sortByRotationPriority } from './rotation';

/**
 * Substitutes: the next `count` candidates by rotation priority.
 * Anyone left after that is over the registration cap ("not selected").
 */
export function selectSubstitutes(
  remaining: readonly Candidate[],
  count: number,
): { substitutes: Candidate[]; notSelected: Candidate[] } {
  const ordered = sortByRotationPriority(remaining);
  const n = Math.max(0, Math.min(count, ordered.length));
  return { substitutes: ordered.slice(0, n), notSelected: ordered.slice(n) };
}
