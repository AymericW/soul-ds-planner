import { describe, expect, it } from 'vitest';
import { applyRosterImportPlan, planRosterImport } from '@/domain/roster/importPlan';
import { makeMember } from '../fixtures';

describe('planRosterImport', () => {
  const existing = [
    makeMember({ id: 'a', name: 'Alpha', power: 100_000_000, activity: 3 }),
    makeMember({ id: 'b', name: 'Bravo', power: 90_000_000, activity: 4, aliases: ['bravissimo'] }),
    makeMember({ id: 'c', name: 'Charlie', power: 80_000_000, activity: 2 }),
  ];

  it('adds new names, updates changed ones (by normalised name or alias), skips duplicates', () => {
    const plan = planRosterImport(existing, [
      { rowNumber: 2, name: 'ALPHA', power: 110_000_000 },
      { rowNumber: 3, name: 'Bravissimo', activity: 5 },
      { rowNumber: 4, name: 'Charlie', power: 80_000_000 },
      { rowNumber: 5, name: 'Delta', power: 70_000_000, activity: 4 },
      { rowNumber: 6, name: 'delta', power: 1 },
    ]);
    expect(plan.toAdd.map((r) => r.name)).toEqual(['Delta']);
    expect(plan.toUpdate.map((u) => u.memberId)).toEqual(['a', 'b']);
    expect(plan.toUpdate[0]!.changes).toContain('power 100.0M → 110.0M');
    expect(plan.unchanged.map((r) => r.name)).toEqual(['Charlie']);
    expect(plan.skipped).toEqual([{ rowNumber: 6, message: 'Duplicate of an earlier row ("delta").' }]);
  });

  it('applies the plan without overwriting fields missing from the file', () => {
    const plan = planRosterImport(existing, [
      { rowNumber: 2, name: 'Bravissimo', activity: 5 },
      { rowNumber: 3, name: 'Echo' },
    ]);
    let n = 0;
    const saved = applyRosterImportPlan(plan, existing, '2026-01-01T00:00:00.000Z', () => `new-${++n}`);
    const bravo = saved.find((m) => m.id === 'b')!;
    expect(bravo).toMatchObject({ name: 'Bravo', power: 90_000_000, activity: 5 });
    const echo = saved.find((m) => m.id === 'new-1')!;
    expect(echo).toMatchObject({ name: 'Echo', power: 0, activity: 3, active: true, aliases: [] });
  });
});
