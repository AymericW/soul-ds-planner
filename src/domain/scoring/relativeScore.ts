import { DEFAULT_SETTINGS } from '@/constants/defaults';
import { ACTIVITY_MAX, ACTIVITY_MIN } from '@/constants/rules';
import type { Member } from '@/models/Member';
import type { ScoringWeights } from '@/models/Settings';

export interface ScoreBreakdown {
  memberId: string;
  /** power / highest power among the eligible applicants (0-1). */
  powerRatio: number;
  /** (activity - 1) / 4  (0-1). */
  activityNorm: number;
  /** Weighted relative score (0-1). */
  score: number;
}

/** Weights are rescaled to sum to 1 (so 7/3 or 70/30 or 0.7/0.3 all mean the same). */
export function normaliseWeights(weights: ScoringWeights): ScoringWeights {
  const power = Math.max(0, weights.power);
  const activity = Math.max(0, weights.activity);
  const sum = power + activity;
  if (!(sum > 0)) return { ...DEFAULT_SETTINGS.weights };
  return { power: power / sum, activity: activity / sum };
}

/**
 * RELATIVE power: ratio to the strongest eligible applicant of THIS week.
 * The strongest applicant gets 1.0, someone with half that power 0.5.
 */
export function relativePower(power: number, maxPower: number): number {
  if (!(maxPower > 0) || !(power > 0)) return 0;
  return Math.min(1, power / maxPower);
}

/** Activity 1..5 mapped linearly to 0..1. */
export function normaliseActivity(activity: number): number {
  const clamped = Math.min(ACTIVITY_MAX, Math.max(ACTIVITY_MIN, activity));
  return (clamped - ACTIVITY_MIN) / (ACTIVITY_MAX - ACTIVITY_MIN);
}

/**
 * score = wPower * power/maxPower + wActivity * (activity-1)/4
 * computed over the given pool (the eligible applicants of the week).
 */
export function computeRelativeScores(pool: readonly Member[], weights: ScoringWeights): Map<string, ScoreBreakdown> {
  const w = normaliseWeights(weights);
  const maxPower = pool.reduce((max, m) => Math.max(max, m.power), 0);
  const result = new Map<string, ScoreBreakdown>();
  for (const m of pool) {
    const powerRatio = relativePower(m.power, maxPower);
    const activityNorm = normaliseActivity(m.activity);
    result.set(m.id, { memberId: m.id, powerRatio, activityNorm, score: w.power * powerRatio + w.activity * activityNorm });
  }
  return result;
}
