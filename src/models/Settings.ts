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
  /** Number of WEEKS a no-show is suspended for (field name kept for stored data compatibility). */
  suspensionEvents: number;
  weights: ScoringWeights;
  /** Scores closer than this are "too close to call": higher activity wins. */
  scoreEpsilon: number;
  /** Shared secret of the public join page (`#/join?code=…`). Empty = join page disabled. */
  joinCode: string;
  /** A self-reported power this many % BELOW the roster value is still applied automatically. */
  powerDropTolerancePct: number;
  /** A self-reported power this many % ABOVE the roster value is still applied automatically. */
  powerRiseTolerancePct: number;
}
