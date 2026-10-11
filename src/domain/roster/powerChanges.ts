import type { Member } from '@/models/Member';
import type { PowerChange } from '@/models/PowerChange';

export function createPowerChange(
  fields: Pick<PowerChange, 'memberId' | 'oldPower' | 'newPower' | 'source' | 'status'>,
  id: string,
  nowIso: string,
): PowerChange {
  return { id, ...fields, createdAt: nowIso };
}

/** History row for a leader edit of a member's power (null when the power did not change). */
export function leaderPowerChange(before: Member | undefined, after: Member, id: string, nowIso: string): PowerChange | null {
  if (!before || before.power === after.power) return null;
  return createPowerChange({ memberId: after.id, oldPower: before.power, newPower: after.power, source: 'leader', status: 'applied' }, id, nowIso);
}

export function pendingPowerChanges(changes: readonly PowerChange[]): PowerChange[] {
  return changes.filter((c) => c.status === 'pending').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** The latest pending change of a member (a player resubmitting replaces their earlier pending value). */
export function pendingPowerChangeOf(changes: readonly PowerChange[], memberId: string): PowerChange | undefined {
  return pendingPowerChanges(changes).filter((c) => c.memberId === memberId).pop();
}

/** Leader decision on a pending change. Approving returns the member with the new power. */
export function resolvePowerChange(
  change: PowerChange,
  approve: boolean,
  member: Member | undefined,
  resolvedBy: string,
  nowIso: string,
): { change: PowerChange; member?: Member } {
  const resolved: PowerChange = { ...change, status: approve ? 'applied' : 'rejected', resolvedAt: nowIso, resolvedBy };
  if (!approve || !member) return { change: resolved };
  return { change: { ...resolved, oldPower: member.power }, member: { ...member, power: change.newPower, updatedAt: nowIso } };
}
