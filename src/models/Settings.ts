export interface ScoringWeights {
  /** Weight of relative power (0-1). */
  power: number;
  /** Weight of activity rating (0-1). */
  activity: number;
}

/** User-configurable rules, persisted. */
export interface Settings {
  coreStarters: number;
  rotationStarters: number;
  substitutes: number;
  /** Number of Team A events a no-show is suspended for. */
  suspensionEvents: number;
  weights: ScoringWeights;
  /** Scores closer than this are "too close to call": higher activity wins. */
  scoreEpsilon: number;
}
