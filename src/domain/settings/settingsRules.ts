import { SETTINGS_LIMITS } from '@/constants/rules';
import type { Settings } from '@/models/Settings';

export type SettingsErrors = Partial<Record<'coreStarters' | 'rotationStarters' | 'substitutes' | 'suspensionEvents' | 'weights' | 'scoreEpsilon', string>>;

type CountField = 'coreStarters' | 'rotationStarters' | 'substitutes' | 'suspensionEvents';

const COUNT_LABELS: Record<CountField, string> = {
  coreStarters: 'Core starters',
  rotationStarters: 'Rotation starters',
  substitutes: 'Substitutes',
  suspensionEvents: 'Suspension length',
};

/** Validates user-entered settings; an empty object means valid. */
export function validateSettings(s: Settings): SettingsErrors {
  const errors: SettingsErrors = {};
  for (const field of Object.keys(COUNT_LABELS) as CountField[]) {
    const { min, max } = SETTINGS_LIMITS[field];
    const v = s[field];
    if (!Number.isInteger(v) || v < min || v > max) errors[field] = `${COUNT_LABELS[field]} must be a whole number from ${min} to ${max}.`;
  }
  if (!errors.coreStarters && !errors.rotationStarters && s.coreStarters + s.rotationStarters === 0) {
    errors.coreStarters = 'At least one starter is needed.';
  }
  const { power, activity } = s.weights;
  if (!(power >= 0 && activity >= 0 && power + activity > 0)) errors.weights = 'Weights must be positive and not both zero.';
  const { min, max } = SETTINGS_LIMITS.scoreEpsilon;
  if (!(s.scoreEpsilon >= min && s.scoreEpsilon <= max)) errors.scoreEpsilon = `Tie margin must be between ${min} and ${max}.`;
  return errors;
}

/** Weights stored as fractions that sum to 1 (UI edits a single "power %" slider). */
export function weightsFromPowerPercent(powerPercent: number): Settings['weights'] {
  const p = Math.min(100, Math.max(0, Math.round(powerPercent)));
  return { power: p / 100, activity: (100 - p) / 100 };
}
