/**
 * Participation statistics derived from finalised events (never stored).
 * Counted in WEEKS: Team A and Team B of the same Friday form one week.
 */
export interface MemberStats {
  memberId: string;
  /** Weeks with a finalised event the member registered for (Team A, Team B or both). */
  weeksRegistered: number;
  /** Weeks the member actually played (in Team A or Team B; a week counts once). */
  weeksPlayed: number;
  /** weeksPlayed / weeksRegistered, or null when never registered. */
  participationRate: number | null;
  /** 0 = played in the most recent finalised week, 1 = the week before, ...; null = never played. */
  weeksSinceLastPlayed: number | null;
  /** Remaining suspended weeks (0 when not suspended). */
  suspensionRemaining: number;
}
