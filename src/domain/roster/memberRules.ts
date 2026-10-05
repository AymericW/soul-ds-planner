import { ACTIVITY_MAX, ACTIVITY_MIN, DEFAULT_ACTIVITY } from '@/constants/rules';
import { cleanDisplayName, normaliseName } from '@/helpers/normalise';
import type { Member, MemberDraft } from '@/models/Member';

export function clampActivity(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_ACTIVITY;
  return Math.min(ACTIVITY_MAX, Math.max(ACTIVITY_MIN, Math.round(value)));
}

export type MemberDraftErrors = Partial<Record<'name' | 'power' | 'activity', string>>;

/** Validates a member form. `editingId` excludes the member being edited from the duplicate check. */
export function validateMemberDraft(
  draft: MemberDraft,
  existing: readonly Member[],
  editingId?: string,
): MemberDraftErrors {
  const errors: MemberDraftErrors = {};
  const name = cleanDisplayName(draft.name);
  const key = normaliseName(name);
  if (!key) errors.name = 'Name is required.';
  else if (existing.some((m) => m.id !== editingId && normaliseName(m.name) === key)) {
    errors.name = 'A member with this name already exists.';
  }
  if (!Number.isFinite(draft.power) || draft.power < 0) errors.power = 'Power must be a positive number (e.g. 152.3M).';
  if (!Number.isInteger(draft.activity) || draft.activity < ACTIVITY_MIN || draft.activity > ACTIVITY_MAX) {
    errors.activity = `Activity must be between ${ACTIVITY_MIN} and ${ACTIVITY_MAX}.`;
  }
  return errors;
}

export function createMember(draft: MemberDraft, id: string, nowIso: string): Member {
  return {
    id,
    name: cleanDisplayName(draft.name),
    aliases: draft.aliases ?? [],
    power: Math.max(0, Math.round(draft.power)),
    activity: clampActivity(draft.activity),
    rank: draft.rank,
    active: draft.active,
    notes: draft.notes,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export function updateMember(member: Member, draft: MemberDraft, nowIso: string): Member {
  return {
    ...member,
    name: cleanDisplayName(draft.name),
    aliases: draft.aliases ?? member.aliases,
    power: Math.max(0, Math.round(draft.power)),
    activity: clampActivity(draft.activity),
    rank: draft.rank,
    active: draft.active,
    notes: draft.notes,
    updatedAt: nowIso,
  };
}

/**
 * Remembers an OCR spelling for a member so future screenshots auto-match.
 * Returns the same member when the alias adds nothing new.
 */
export function addAlias(member: Member, rawAlias: string, nowIso: string): Member {
  const alias = normaliseName(rawAlias);
  if (!alias || alias === normaliseName(member.name) || member.aliases.includes(alias)) return member;
  return { ...member, aliases: [...member.aliases, alias], updatedAt: nowIso };
}

export function removeAlias(member: Member, alias: string, nowIso: string): Member {
  return { ...member, aliases: member.aliases.filter((a) => a !== alias), updatedAt: nowIso };
}

export function findMemberByName(members: readonly Member[], name: string): Member | undefined {
  const key = normaliseName(name);
  if (!key) return undefined;
  return members.find((m) => normaliseName(m.name) === key) ?? members.find((m) => m.aliases.includes(key));
}

export function sortMembersByName(members: readonly Member[]): Member[] {
  return [...members].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}
