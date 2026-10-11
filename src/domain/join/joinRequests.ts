import { cleanDisplayName, normaliseName } from '@/helpers/normalise';
import type { JoinChoices, JoinRequest } from '@/models/JoinRequest';

export function pendingJoinRequests(requests: readonly JoinRequest[]): JoinRequest[] {
  return requests.filter((r) => r.status === 'pending').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * "I'm not in the list": creates a pending request, or refreshes the pending request with the same
 * normalised name for the same week (a player sending twice never creates duplicates).
 */
export function upsertUnlistedRequest(
  requests: readonly JoinRequest[],
  input: { name: string; power: number; choices: JoinChoices; weekDate: string },
  id: string,
  nowIso: string,
): JoinRequest {
  const name = cleanDisplayName(input.name);
  const normalisedName = normaliseName(name);
  const existing = requests.find((r) => r.status === 'pending' && r.normalisedName === normalisedName && r.weekDate === input.weekDate);
  if (existing) return { ...existing, name, power: input.power, choices: input.choices, updatedAt: nowIso };
  return { id, status: 'pending', name, normalisedName, power: input.power, choices: input.choices, weekDate: input.weekDate, createdAt: nowIso, updatedAt: nowIso };
}

export function resolveJoinRequest(
  request: JoinRequest,
  status: 'approved' | 'rejected',
  resolvedBy: string,
  nowIso: string,
  linkedMemberId?: string,
): JoinRequest {
  return { ...request, status, resolvedBy, resolvedAt: nowIso, updatedAt: nowIso, ...(linkedMemberId ? { linkedMemberId } : {}) };
}
