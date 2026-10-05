import { describe, expect, it } from 'vitest';
import { validateSettings, weightsFromPowerPercent } from '@/domain/settings/settingsRules';
import { makeSettings } from '../fixtures';

describe('settings rules', () => {
  it('accepts the defaults', () => {
    expect(validateSettings(makeSettings())).toEqual({});
  });

  it('rejects out-of-range or non-integer counts and zero starters', () => {
    expect(Object.keys(validateSettings(makeSettings({ coreStarters: -1, substitutes: 2.5, suspensionEvents: 99 })))).toEqual([
      'coreStarters',
      'substitutes',
      'suspensionEvents',
    ]);
    expect(validateSettings(makeSettings({ coreStarters: 0, rotationStarters: 0 })).coreStarters).toBe('At least one starter is needed.');
  });

  it('rejects zero weights and a negative tie margin', () => {
    const errors = validateSettings(makeSettings({ weights: { power: 0, activity: 0 }, scoreEpsilon: -0.1 }));
    expect(Object.keys(errors).sort()).toEqual(['scoreEpsilon', 'weights']);
  });

  it('converts the power slider percentage to weights summing to 1', () => {
    expect(weightsFromPowerPercent(70)).toEqual({ power: 0.7, activity: 0.3 });
    expect(weightsFromPowerPercent(120)).toEqual({ power: 1, activity: 0 });
  });
});
