import { describe, expect, it } from 'vitest';
import { canAdminister, canChangeRole, canEditAllianceData } from '@/domain/accounts/permissions';

describe('account permissions', () => {
  it('lets only approved leaders edit alliance data', () => {
    expect(canEditAllianceData('r4')).toBe(true);
    expect(canEditAllianceData('r5')).toBe(true);
    expect(canEditAllianceData('pending')).toBe(false);
    expect(canEditAllianceData('disabled')).toBe(false);
    expect(canEditAllianceData(undefined)).toBe(false);
  });

  it('reserves administration for R5', () => {
    expect(canAdminister('r5')).toBe(true);
    expect(canAdminister('r4')).toBe(false);
  });

  it('lets an R5 change other accounts but never their own role', () => {
    expect(canChangeRole('me', 'other', 'r5')).toBe(true);
    expect(canChangeRole('me', 'me', 'r5')).toBe(false);
    expect(canChangeRole('me', 'other', 'r4')).toBe(false);
  });
});
