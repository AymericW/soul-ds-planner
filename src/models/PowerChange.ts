/** One change of a member's power, kept as history. */
export interface PowerChange {
  id: string;
  memberId: string;
  oldPower: number;
  newPower: number;
  /** self: entered by the player on the join page · leader: edited by an R4/R5. */
  source: 'self' | 'leader';
  /** applied: roster updated · pending: out of the tolerated range, waits for a leader · rejected: dismissed. */
  status: 'applied' | 'pending' | 'rejected';
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}
