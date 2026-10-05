import type { Member } from '@/models/Member';
import type { ScoreBreakdown } from './relativeScore';

export interface ScoredMember {
  member: Member;
  score: ScoreBreakdown;
}

/** Deterministic final tie-break: activity, power, then name, then id. */
export function compareByActivityPowerName(a: Member, b: Member): number {
  return (
    b.activity - a.activity ||
    b.power - a.power ||
    a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) ||
    a.id.localeCompare(b.id)
  );
}

/**
 * Ranks for the core:
 * 1. sort by score (desc), exact ties broken by activity, power, name;
 * 2. "close call" pass: when a player's score is within `epsilon` of the player
 *    directly above and they have HIGHER activity, they swap. Repeated until
 *    stable. Each swap removes one activity inversion, so it always terminates.
 */
export function rankByScore(entries: readonly ScoredMember[], epsilon: number): ScoredMember[] {
  const ranked = [...entries].sort(
    (a, b) => b.score.score - a.score.score || compareByActivityPowerName(a.member, b.member),
  );
  if (!(epsilon > 0)) return ranked;
  let swapped = true;
  while (swapped) {
    swapped = false;
    for (let i = 0; i + 1 < ranked.length; i++) {
      const upper = ranked[i]!;
      const lower = ranked[i + 1]!;
      const close = Math.abs(upper.score.score - lower.score.score) <= epsilon + 1e-12;
      if (close && lower.member.activity > upper.member.activity) {
        ranked[i] = lower;
        ranked[i + 1] = upper;
        swapped = true;
      }
    }
  }
  return ranked;
}
