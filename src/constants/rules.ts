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
} as const;

/** Minimum similarity (0-1) for an OCR line to auto-match a member name. */
export const OCR_MATCH_THRESHOLD = 0.8;
/** Names this short (normalised) must match more strictly to avoid false positives. */
export const OCR_SHORT_NAME_LENGTH = 4;
export const OCR_SHORT_NAME_THRESHOLD = 0.92;
