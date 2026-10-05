/** A penalty: the member cannot be selected for the next `totalEvents` Team A events. */
export interface Suspension {
  id: string;
  memberId: string;
  /** Event whose no-show caused the suspension. */
  sourceEventId: string;
  createdAt: string;
  totalEvents: number;
  remainingEvents: number;
  reason: string;
  /** Set when an R4 lifts the suspension early. */
  liftedAt?: string;
}
