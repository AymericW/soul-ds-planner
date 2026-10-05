import type { Settings } from '@/models/Settings';

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  coreStarters: 14,
  rotationStarters: 6,
  substitutes: 10,
  suspensionEvents: 2,
  weights: Object.freeze({ power: 0.7, activity: 0.3 }),
  scoreEpsilon: 0.02,
});
