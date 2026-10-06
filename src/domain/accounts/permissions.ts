import type { AccountRole } from '@/models/Account';

/** R4 and R5 may read and edit all alliance data (the database enforces the same rule). */
export function canEditAllianceData(role: AccountRole | undefined): boolean {
  return role === 'r4' || role === 'r5';
}

/** Account management and destructive data operations (reset, restore) are R5 only. */
export function canAdminister(role: AccountRole | undefined): boolean {
  return role === 'r5';
}

/** An R5 cannot demote or disable themselves (the database also keeps at least one R5). */
export function canChangeRole(actorId: string, targetId: string, actorRole: AccountRole | undefined): boolean {
  return canAdminister(actorRole) && actorId !== targetId;
}
