import { DEFAULT_SETTINGS } from '@/constants/defaults';
import type { Settings } from '@/models/Settings';

/** Fills missing/invalid stored fields with defaults (forward compatible with older backups). */
export function mergeWithDefaultSettings(stored: Partial<Settings> | undefined): Settings {
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  return {
    coreStarters: num(stored?.coreStarters, DEFAULT_SETTINGS.coreStarters),
    rotationStarters: num(stored?.rotationStarters, DEFAULT_SETTINGS.rotationStarters),
    substitutes: num(stored?.substitutes, DEFAULT_SETTINGS.substitutes),
    suspensionEvents: num(stored?.suspensionEvents, DEFAULT_SETTINGS.suspensionEvents),
    weights: {
      power: num(stored?.weights?.power, DEFAULT_SETTINGS.weights.power),
      activity: num(stored?.weights?.activity, DEFAULT_SETTINGS.weights.activity),
    },
    scoreEpsilon: num(stored?.scoreEpsilon, DEFAULT_SETTINGS.scoreEpsilon),
  };
}
