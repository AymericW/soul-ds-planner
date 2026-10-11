import type { Member } from '@/models/Member';
import type { ScoreBreakdown } from '@/domain/scoring/relativeScore';

/** An eligible applicant with everything the selection needs to know. */
export interface Candidate {
  member: Member;
  score: ScoreBreakdown;
  /** Played (Team A or Team B) in the most recent finalised week. */
  playedLastWeek: boolean;
  /** 0 = played in the last finalised week; null = never played. */
  weeksSinceLastPlayed: number | null;
}
