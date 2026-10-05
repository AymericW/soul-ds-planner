import { compareByActivityPowerName } from '@/domain/scoring/coreRanking';
import type { Candidate } from './candidates';

/**
 * Rotation priority (higher priority first):
 * 1. did NOT play the last finalised event;
 * 2. longest time since last played (never played = longest);
 * 3. higher activity, then higher power (then name for determinism).
 */
export function compareRotationPriority(a: Candidate, b: Candidate): number {
  if (a.playedLastEvent !== b.playedLastEvent) return a.playedLastEvent ? 1 : -1;
  const sinceA = a.eventsSinceLastPlayed ?? Number.POSITIVE_INFINITY;
  const sinceB = b.eventsSinceLastPlayed ?? Number.POSITIVE_INFINITY;
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
