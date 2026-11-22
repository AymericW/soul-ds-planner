import { t } from '@/helpers/i18n';
import { JOIN_CODE_PATTERN, SETTINGS_LIMITS } from '@/constants/rules';
import type { Settings } from '@/models/Settings';

export type SettingsErrors = Partial<
  Record<
    | 'coreStarters'
    | 'rotationStarters'
    | 'substitutes'
    | 'suspensionEvents'
    | 'weights'
    | 'scoreEpsilon'
    | 'joinCode'
    | 'powerDropTolerancePct'
    | 'powerRiseTolerancePct',
    string
  >
>;

type CountField = 'coreStarters' | 'rotationStarters' | 'substitutes' | 'suspensionEvents' | 'powerDropTolerancePct' | 'powerRiseTolerancePct';

const COUNT_FIELDS: readonly CountField[] = [
  'coreStarters',
  'rotationStarters',
  'substitutes',
  'suspensionEvents',
  'powerDropTolerancePct',
  'powerRiseTolerancePct',
];

/** Validates user-entered settings; an empty object means valid. */
export function validateSettings(s: Settings): SettingsErrors {
  const errors: SettingsErrors = {};
  for (const field of COUNT_FIELDS) {
    const { min, max } = SETTINGS_LIMITS[field];
    const v = s[field];
    if (!Number.isInteger(v) || v < min || v > max) errors[field] = t().rules.settingRange(t().rules.settingLabels[field], min, max);
  }
  if (!errors.coreStarters && !errors.rotationStarters && s.coreStarters + s.rotationStarters === 0) {
    errors.coreStarters = t().rules.atLeastOneStarter;
  }
  const { power, activity } = s.weights;
  if (!(power >= 0 && activity >= 0 && power + activity > 0)) errors.weights = t().rules.weightsPositive;
  const { min, max } = SETTINGS_LIMITS.scoreEpsilon;
  if (!(s.scoreEpsilon >= min && s.scoreEpsilon <= max)) errors.scoreEpsilon = t().rules.tieMargin(min, max);
  if (s.joinCode !== '' && !JOIN_CODE_PATTERN.test(s.joinCode)) errors.joinCode = t().rules.joinCodeFormat;
  return errors;
}

/** Weights stored as fractions that sum to 1 (UI edits a single "power %" slider). */
export function weightsFromPowerPercent(powerPercent: number): Settings['weights'] {
  const p = Math.min(100, Math.max(0, Math.round(powerPercent)));
  return { power: p / 100, activity: (100 - p) / 100 };
}
