import { rankByScore } from '@/domain/scoring/coreRanking';
import type { Candidate } from './candidates';

/**
 * Core starters: the `count` best candidates by relative score
 * (close scores resolved in favour of higher activity).
 * Returns the core (in rank order) and everyone else.
 */
export function selectCore(
  candidates: readonly Candidate[],
  count: number,
  epsilon: number,
): { core: Candidate[]; rest: Candidate[] } {
  const byId = new Map(candidates.map((c) => [c.member.id, c]));
  const ranked = rankByScore(
    candidates.map((c) => ({ member: c.member, score: c.score })),
    epsilon,
  ).map((s) => byId.get(s.member.id)!);
  const n = Math.max(0, Math.min(count, ranked.length));
  return { core: ranked.slice(0, n), rest: ranked.slice(n) };
}
