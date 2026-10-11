/** A penalty: the member cannot be selected for the next `totalEvents` weeks (Team A and Team B). */
export interface Suspension {
  id: string;
  memberId: string;
  /** Event whose no-show caused the suspension. */
  sourceEventId: string;
  createdAt: string;
  /** Length in weeks (field name kept for stored data compatibility). */
  totalEvents: number;
  /** Weeks left. */
  remainingEvents: number;
  reason: string;
  /** Set when an R4 lifts the suspension early. */
  liftedAt?: string;
}
