/** Participation statistics derived from finalised events (never stored). */
export interface MemberStats {
  memberId: string;
  /** Finalised events the member registered for. */
  eventsRegistered: number;
  /** Finalised events the member actually played (starter who attended, or substitute who entered). */
  timesPlayed: number;
  /** timesPlayed / eventsRegistered, or null when never registered. */
  participationRate: number | null;
  /** 0 = played in the most recent finalised event, 1 = the one before, ...; null = never played. */
  eventsSinceLastPlayed: number | null;
  /** Remaining suspended events (0 when not suspended). */
  suspensionRemaining: number;
}
