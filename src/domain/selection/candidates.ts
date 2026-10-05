import type { Member } from '@/models/Member';
import type { ScoreBreakdown } from '@/domain/scoring/relativeScore';

/** An eligible applicant with everything the selection needs to know. */
export interface Candidate {
  member: Member;
  score: ScoreBreakdown;
  playedLastEvent: boolean;
  /** 0 = played last finalised event; null = never played. */
  eventsSinceLastPlayed: number | null;
}
