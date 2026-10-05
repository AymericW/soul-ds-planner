/** Post-event record for one assigned player. */
export interface Attendance {
  memberId: string;
  /** Entered the event (for substitutes: was called in and entered). */
  attended: boolean;
  /** For absent starters: told an R4 or arranged a substitute (even late). */
  notified: boolean;
}
