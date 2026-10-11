import { compareByActivityPowerName } from '@/domain/scoring/coreRanking';
import type { Candidate } from './candidates';

/**
 * Rotation priority (higher priority first):
 * 1. did NOT play in the last finalised week (Team A or Team B);
 * 2. longest time (in weeks) since last played (never played = longest);
 * 3. higher activity, then higher power (then name for determinism).
 */
export function compareRotationPriority(a: Candidate, b: Candidate): number {
  if (a.playedLastWeek !== b.playedLastWeek) return a.playedLastWeek ? 1 : -1;
  const sinceA = a.weeksSinceLastPlayed ?? Number.POSITIVE_INFINITY;
  const sinceB = b.weeksSinceLastPlayed ?? Number.POSITIVE_INFINITY;
  if (sinceA !== sinceB) return sinceB > sinceA ? 1 : -1;
  return compareByActivityPowerName(a.member, b.member);
}

export function sortByRotationPriority(candidates: readonly Candidate[]): Candidate[] {
  return [...candidates].sort(compareRotationPriority);
}

/** Rotation starters: the `count` non-core candidates with the highest rotation priority. */
export function selectRotation(
  nonCore: readonly Candidate[],
  count: number,
): { rotation: Candidate[]; rest: Candidate[] } {
  const ordered = sortByRotationPriority(nonCore);
  const n = Math.max(0, Math.min(count, ordered.length));
  return { rotation: ordered.slice(0, n), rest: ordered.slice(n) };
}
