import { DEFAULT_ACTIVITY } from '@/constants/rules';
import { normaliseName } from '@/helpers/normalise';
import { formatPower } from '@/helpers/format';
import type { Member } from '@/models/Member';
import type { RosterImportIssue, RosterImportPlan, RosterImportRow } from '@/models/RosterImport';
import { clampActivity, createMember } from './memberRules';

/**
 * Compares parsed rows with the current roster (matched by normalised name,
 * then by alias) and decides what to add, update, leave unchanged or skip.
 * Fields missing in the file never overwrite existing values.
 */
export function planRosterImport(
  existing: readonly Member[],
  rows: readonly RosterImportRow[],
  parseIssues: readonly RosterImportIssue[] = [],
): RosterImportPlan {
  const plan: RosterImportPlan = { toAdd: [], toUpdate: [], unchanged: [], skipped: [...parseIssues] };
  const byName = new Map(existing.map((m) => [normaliseName(m.name), m]));
  const seen = new Set<string>();

  for (const row of rows) {
    const key = normaliseName(row.name);
    if (!key) {
      plan.skipped.push({ rowNumber: row.rowNumber, message: 'Missing name.' });
      continue;
    }
    if (seen.has(key)) {
      plan.skipped.push({ rowNumber: row.rowNumber, message: `Duplicate of an earlier row ("${row.name}").` });
      continue;
    }
    seen.add(key);
    const member = byName.get(key) ?? existing.find((m) => m.aliases.includes(key));
    if (!member) {
      plan.toAdd.push(row);
      continue;
    }
    const changes: string[] = [];
    if (row.power !== undefined && row.power !== member.power) {
      changes.push(`power ${formatPower(member.power)} → ${formatPower(row.power)}`);
    }
    if (row.activity !== undefined && row.activity !== member.activity) {
      changes.push(`activity ${member.activity} → ${row.activity}`);
    }
    if (row.rank !== undefined && row.rank !== member.rank) changes.push(`rank ${member.rank ?? '–'} → ${row.rank}`);
    if (row.active !== undefined && row.active !== member.active) {
      changes.push(row.active ? 'reactivated' : 'set inactive');
    }
    if (row.name !== member.name && normaliseName(row.name) === normaliseName(member.name)) {
      changes.push(`name "${member.name}" → "${row.name}"`);
    }
    if (changes.length) plan.toUpdate.push({ memberId: member.id, existingName: member.name, row, changes });
    else plan.unchanged.push(row);
  }
  plan.skipped.sort((a, b) => a.rowNumber - b.rowNumber);
  return plan;
}

/** Turns an approved plan into the members to save (new + updated). */
export function applyRosterImportPlan(
  plan: RosterImportPlan,
  existing: readonly Member[],
  nowIso: string,
  newId: () => string,
): Member[] {
  const result: Member[] = [];
  for (const row of plan.toAdd) {
    result.push(
      createMember(
        {
          name: row.name,
          power: row.power ?? 0,
          activity: clampActivity(row.activity ?? DEFAULT_ACTIVITY),
          rank: row.rank,
          active: row.active ?? true,
        },
        newId(),
        nowIso,
      ),
    );
  }
  const byId = new Map(existing.map((m) => [m.id, m]));
  for (const update of plan.toUpdate) {
    const member = byId.get(update.memberId);
    if (!member) continue;
    const { row } = update;
    const sameName = normaliseName(row.name) === normaliseName(member.name);
    result.push({
      ...member,
      name: sameName ? row.name : member.name,
      power: row.power ?? member.power,
      activity: row.activity !== undefined ? clampActivity(row.activity) : member.activity,
      rank: row.rank ?? member.rank,
      active: row.active ?? member.active,
      updatedAt: nowIso,
    });
  }
  return result;
}
