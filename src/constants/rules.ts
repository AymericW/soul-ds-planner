/** Fixed rule values and the bounds the Settings screen accepts. */
export const ACTIVITY_MIN = 1;
export const ACTIVITY_MAX = 5;
export const DEFAULT_ACTIVITY = 3;

export const SETTINGS_LIMITS = {
  coreStarters: { min: 0, max: 40 },
  rotationStarters: { min: 0, max: 40 },
  substitutes: { min: 0, max: 40 },
  suspensionEvents: { min: 0, max: 10 },
  scoreEpsilon: { min: 0, max: 0.2 },
  powerDropTolerancePct: { min: 0, max: 50 },
  powerRiseTolerancePct: { min: 0, max: 200 },
} as const;

/**
 * Public join page limits. The same values are hard-coded in
 * supabase/migrations/0002_two_events_and_join.sql (keep them in sync).
 */
export const JOIN_LIMITS = {
  /** Accepted self-reported power (raw number). */
  powerMin: 1_000_000,
  powerMax: 5_000_000_000,
  nameMinLength: 2,
  nameMaxLength: 32,
  /** A member can submit at most this many times per window. */
  submitsPerMember: 6,
  submitWindowMinutes: 10,
  /** The same (normalised) unlisted name can be requested at most this many times per window. */
  requestsPerName: 3,
  requestWindowMinutes: 60,
  /** All new unlisted requests together (stops someone flooding with made-up names), per window. */
  requestsTotal: 10,
  /** No new unlisted requests while this many are pending. */
  maxPendingRequests: 30,
} as const;

/** Join codes: unambiguous upper-case letters and digits. */
export const JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const JOIN_CODE_LENGTH = 8;
export const JOIN_CODE_PATTERN = /^[A-Z0-9]{6,16}$/;

/** Minimum similarity (0-1) for an OCR line to auto-match a member name. */
export const OCR_MATCH_THRESHOLD = 0.8;
/** Names this short (normalised) must match more strictly to avoid false positives. */
export const OCR_SHORT_NAME_LENGTH = 4;
export const OCR_SHORT_NAME_THRESHOLD = 0.92;

/** Words that appear around names on poll / battle screenshots and are never names. */
export const OCR_NOISE_WORDS: readonly string[] = [
  'yes', 'no', 'v', 'pts', 'points', 'pt', 'vote', 'votes', 'voted', 'power', 'team', 'soul', 'score', 'kills', 'join', 'joined',
  'will', 'the', 'and', 'desert', 'storm', 'battle', 'report', 'poll', 'option', 'participants', 'participant', 'players',
  'player', 'total', 'rank', 'alliance', 'members', 'member', 'event', 'result', 'results', 'teama', 'teamb',
  // French game UI
  'puissance', 'membres', 'votants', 'les', 'suivants', 'ont', 'choisi', 'lors', 'cette', 'option', 'niveau', 'lv', 'de', 'ce', 'vote', 'choisi', 'selectionne',
];
