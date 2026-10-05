import { describe, expect, it } from 'vitest';
import { compareRotationPriority } from '@/domain/selection/rotation';
import { registrationCap, runSelection, type SelectionInput } from '@/domain/selection/runSelection';
import type { Slot } from '@/models/Assignment';
import type { Member } from '@/models/Member';
import { makeFinalisedEvent, makeMember, makeSettings, makeSuspension } from '../fixtures';

function slots(result: ReturnType<typeof runSelection>): Record<Slot, string[]> {
  const out: Record<Slot, string[]> = { core: [], rotation: [], substitute: [], notSelected: [] };
  for (const a of [...result.assignments].sort((x, y) => x.order - y.order)) out[a.slot].push(a.memberId);
  return out;
}

function input(members: Member[], partial: Partial<SelectionInput> = {}): SelectionInput {
  return {
    members,
    registrations: members.map((m) => ({ memberId: m.id, source: 'manual' as const })),
    history: [],
    suspensions: [],
    settings: makeSettings({ coreStarters: 2, rotationStarters: 2, substitutes: 2 }),
    ...partial,
  };
}

/** m1 strongest ... mN weakest, all activity 3 */
function roster(n: number): Member[] {
  return Array.from({ length: n }, (_, i) => makeMember({ id: `m${i + 1}`, name: `M${String(i + 1).padStart(2, '0')}`, power: (100 - i) * 1_000_000 }));
}

describe('core selection', () => {
  it('takes the top relative scores as core', () => {
    const result = runSelection(input(roster(6)));
    expect(slots(result).core).toEqual(['m1', 'm2']);
  });

  it('can prefer a slightly weaker but much more active player (weights)', () => {
    const members = [
      makeMember({ id: 'strong-idle', power: 200_000_000, activity: 1 }),
      makeMember({ id: 'active', power: 180_000_000, activity: 5 }),
      makeMember({ id: 'other', power: 100_000_000, activity: 3 }),
    ];
    const result = runSelection(input(members, { settings: makeSettings({ coreStarters: 1, rotationStarters: 0, substitutes: 5 }) }));
    // strong-idle: 0.7*1 + 0 = 0.70 ; active: 0.7*0.9 + 0.3 = 0.93
    expect(slots(result).core).toEqual(['active']);
    const core = result.assignments.find((a) => a.memberId === 'active')!;
    expect(core.reason).toContain('score 0.93');
    expect(core.score).toBeCloseTo(0.93, 3);
  });
});

describe('rotation priority', () => {
  it('puts players who did not play last event first, then longest since last played', () => {
    const members = roster(7);
    // m1,m2 always core. History (oldest -> newest):
    // e1: m3 played. e2: m4 played. e3 (last): m5 played; m6 never played; m7 played e1.
    const history = [
      makeFinalisedEvent('e1', '2026-01-01', { m3: 'rotation', m7: 'rotation' }, ['m3', 'm7']),
      makeFinalisedEvent('e2', '2026-01-08', { m4: 'rotation' }, ['m4']),
      makeFinalisedEvent('e3', '2026-01-15', { m5: 'rotation' }, ['m5']),
    ];
    const result = runSelection(input(members, { history, settings: makeSettings({ coreStarters: 2, rotationStarters: 2, substitutes: 3 }) }));
    const s = slots(result);
    expect(s.core).toEqual(['m1', 'm2']);
    // never played (m6) > 2 events ago (m3, m7: tie -> activity equal -> power: m3 > m7) > 1 ago (m4) > played last (m5)
    expect(s.rotation).toEqual(['m6', 'm3']);
    expect(s.substitute).toEqual(['m7', 'm4', 'm5']);
    expect(result.assignments.find((a) => a.memberId === 'm6')!.reason).toContain('never played');
    expect(result.assignments.find((a) => a.memberId === 'm5')!.reason).toContain('played last event');
  });

  it('breaks ties by activity then power', () => {
    const c = (id: string, activity: number, power: number) => ({
      member: makeMember({ id, activity, power }),
      score: { memberId: id, powerRatio: 0, activityNorm: 0, score: 0 },
      playedLastEvent: false,
      eventsSinceLastPlayed: 2,
    });
    const sorted = [c('low-act', 2, 300), c('hi-act-weak', 5, 100), c('hi-act-strong', 5, 200)].sort(compareRotationPriority);
    expect(sorted.map((x) => x.member.id)).toEqual(['hi-act-strong', 'hi-act-weak', 'low-act']);
  });

  it('keeps an unused substitute at the top of the rotation next week', () => {
    const members = roster(5);
    const settings = makeSettings({ coreStarters: 2, rotationStarters: 1, substitutes: 2 });
    // last week: m3 rotation (played), m4 substitute NOT used, m5 substitute used.
    const history = [makeFinalisedEvent('e1', '2026-01-01', { m1: 'core', m2: 'core', m3: 'rotation', m4: 'substitute', m5: 'substitute' }, ['m1', 'm2', 'm3', 'm5'])];
    const s = slots(runSelection(input(members, { history, settings })));
    expect(s.rotation).toEqual(['m4']);
    expect(s.substitute).toEqual(['m3', 'm5']);
  });
});

describe('under / over the registration cap', () => {
  it('derives the cap from the configured counts (default 14 + 6 + 10 = 30)', () => {
    expect(registrationCap(makeSettings())).toBe(30);
    expect(registrationCap(makeSettings({ coreStarters: 10, rotationStarters: 5, substitutes: 5 }))).toBe(20);
  });

  it('under the cap everyone gets in: starters first, the rest substitutes, nobody cut', () => {
    const result = runSelection(input(roster(5), { settings: makeSettings() }));
    const s = slots(result);
    expect(s.core).toHaveLength(5);
    expect(s.rotation).toHaveLength(0);
    expect(s.notSelected).toHaveLength(0);
    expect(result.summary.overCap).toBe(false);

    const result25 = runSelection(input(roster(25), { settings: makeSettings() }));
    const s25 = slots(result25);
    expect([s25.core.length, s25.rotation.length, s25.substitute.length, s25.notSelected.length]).toEqual([14, 6, 5, 0]);
  });

  it('over the cap the lowest rotation priority are not selected', () => {
    const members = roster(8);
    const history = [makeFinalisedEvent('e1', '2026-01-01', { m7: 'rotation', m8: 'rotation' }, ['m7', 'm8'])];
    const result = runSelection(input(members, { history }));
    const s = slots(result);
    expect(s.core.length + s.rotation.length + s.substitute.length).toBe(6);
    expect(s.notSelected).toEqual(['m7', 'm8']);
    expect(result.summary.overCap).toBe(true);
    expect(result.assignments.find((a) => a.memberId === 'm8')!.reason).toContain('Over the cap of 6');
  });

  it('respects configurable counts', () => {
    const settings = makeSettings({ coreStarters: 3, rotationStarters: 1, substitutes: 1 });
    const s = slots(runSelection(input(roster(7), { settings })));
    expect([s.core.length, s.rotation.length, s.substitute.length, s.notSelected.length]).toEqual([3, 1, 1, 2]);
  });
});

describe('eligibility', () => {
  it('excludes inactive and suspended members with a reason, and ignores unknown ids', () => {
    const members = [
      makeMember({ id: 'ok' }),
      makeMember({ id: 'inactive', active: false, power: 999_000_000 }),
      makeMember({ id: 'suspended', power: 999_000_000 }),
      makeMember({ id: 'served', power: 50_000_000 }),
    ];
    const suspensions = [
      makeSuspension({ id: 's1', memberId: 'suspended', remainingEvents: 1 }),
      makeSuspension({ id: 's2', memberId: 'served', remainingEvents: 0 }),
    ];
    const registrations = [...members.map((m) => ({ memberId: m.id, source: 'manual' as const })), { memberId: 'ghost', source: 'ocr' as const }];
    const result = runSelection(input(members, { registrations, suspensions }));
    const s = slots(result);
    expect(s.core).toEqual(['ok', 'served']);
    expect(s.notSelected.sort()).toEqual(['inactive', 'suspended']);
    expect(result.assignments.find((a) => a.memberId === 'suspended')!.reason).toContain('Suspended – 1 event left');
    expect(result.assignments.find((a) => a.memberId === 'inactive')!.reason).toContain('Inactive');
    expect(result.assignments.some((a) => a.memberId === 'ghost')).toBe(false);
    expect(result.summary).toEqual({ applicants: 4, eligible: 2, cap: 6, overCap: false });
  });

  it('uses power relative to ELIGIBLE applicants only (suspended giants do not shrink everyone)', () => {
    const members = [makeMember({ id: 'a', power: 100_000_000, activity: 3 }), makeMember({ id: 'giant', power: 900_000_000 })];
    const result = runSelection(input(members, { suspensions: [makeSuspension({ id: 's', memberId: 'giant' })] }));
    expect(result.assignments.find((x) => x.memberId === 'a')!.reason).toContain('power 100% of top');
  });

  it('ignores duplicate registrations', () => {
    const members = roster(2);
    const registrations = [{ memberId: 'm1', source: 'ocr' as const }, { memberId: 'm1', source: 'manual' as const }, { memberId: 'm2', source: 'manual' as const }];
    expect(runSelection(input(members, { registrations })).assignments).toHaveLength(2);
  });
});
