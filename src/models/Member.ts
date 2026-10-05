export const MEMBER_RANKS = ['R1', 'R2', 'R3', 'R4', 'R5'] as const;
export type MemberRank = (typeof MEMBER_RANKS)[number];

/** An alliance member. Activity (1-5) is assigned by R4s. */
export interface Member {
  id: string;
  name: string;
  /** Alternative spellings learnt from OCR corrections (stored normalised). */
  aliases: string[];
  /** Total power (raw number, e.g. 152_300_000). */
  power: number;
  /** Activity rating 1 (low) - 5 (high). */
  activity: number;
  rank?: MemberRank;
  active: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type MemberDraft = Pick<Member, 'name' | 'power' | 'activity' | 'active'> &
  Partial<Pick<Member, 'rank' | 'notes' | 'aliases'>>;
