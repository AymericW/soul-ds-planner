import { describe, expect, it } from 'vitest';
import { createWeekEvent } from '@/domain/events/weekEvents';
import { pendingJoinRequests, resolveJoinRequest, upsertUnlistedRequest } from '@/domain/join/joinRequests';
import {
  applyJoinChoice,
  choiceOfRegistration,
  evaluatePowerUpdate,
  generateJoinCode,
  joinCodeMatches,
  parseJoinChoices,
  validateJoinPower,
  validateUnlistedName,
} from '@/domain/join/joinRules';
import { suggestMembersForName } from '@/domain/roster/nameSuggestions';
import { leaderPowerChange, pendingPowerChangeOf, resolvePowerChange } from '@/domain/roster/powerChanges';
import { validateSettings } from '@/domain/settings/settingsRules';
import { JOIN_CODE_PATTERN } from '@/constants/rules';
import type { PowerChange } from '@/models/PowerChange';
import { makeMember, makeSettings } from '../fixtures';

const T = '2026-10-12T10:00:00.000Z';
const T2 = '2026-10-13T10:00:00.000Z';

describe('join code', () => {
  it('matches case-insensitively and never when no code is set', () => {
    expect(joinCodeMatches('AB12CD34', ' ab12cd34 ')).toBe(true);
    expect(joinCodeMatches('AB12CD34', 'AB12CD35')).toBe(false);
    expect(joinCodeMatches('', '')).toBe(false);
  });

  it('generates valid codes and the settings validate them', () => {
    const code = generateJoinCode(() => 0.5);
    expect(code).toMatch(JOIN_CODE_PATTERN);
    expect(validateSettings(makeSettings({ joinCode: code }))).toEqual({});
    expect(validateSettings(makeSettings({ joinCode: 'bad code' })).joinCode).toBeDefined();
    expect(validateSettings(makeSettings({ powerRiseTolerancePct: 500 })).powerRiseTolerancePct).toBeDefined();
  });
});

describe('join form validation', () => {
  it('accepts a sane power only', () => {
    expect(validateJoinPower(152_300_000)).toBeNull();
    expect(validateJoinPower(undefined)).toContain('152.3M');
    expect(validateJoinPower(500)).toContain('between');
    expect(validateJoinPower(9e12)).toContain('between');
  });

  it('accepts only A/B choices with none/play/sub', () => {
    expect(parseJoinChoices({ A: 'play' })).toEqual({ A: 'play', B: 'none' });
    expect(parseJoinChoices({ A: 'play', B: 'sub' })).toEqual({ A: 'play', B: 'sub' });
    expect(parseJoinChoices({ A: 'maybe' })).toBeNull();
    expect(parseJoinChoices({ C: 'play' })).toBeNull();
    expect(parseJoinChoices(['play'])).toBeNull();
  });

  it('limits unlisted names', () => {
    expect(validateUnlistedName('  New Player ')).toBeNull();
    expect(validateUnlistedName('!')).not.toBeNull();
    expect(validateUnlistedName('x'.repeat(40))).toContain('at most');
  });
});

describe('registration mapping (join page -> poll registration)', () => {
  const event = createWeekEvent('2026-10-16', 'A', T);

  it('play = normal applicant, sub = substitute only, both with source "self", time and entered power', () => {
    const play = applyJoinChoice(event, 'm1', 'play', 150_000_000, T);
    expect(play.registrations).toEqual([{ memberId: 'm1', source: 'self', submittedAt: T, enteredPower: 150_000_000 }]);
    expect(choiceOfRegistration(play.registrations[0])).toBe('play');
    const sub = applyJoinChoice(play, 'm1', 'sub', 151_000_000, T2);
    expect(sub.registrations).toEqual([{ memberId: 'm1', source: 'self', substituteOnly: true, submittedAt: T2, enteredPower: 151_000_000 }]);
    expect(choiceOfRegistration(sub.registrations[0])).toBe('sub');
  });

  it('resubmitting updates in place (no duplicates, position kept)', () => {
    let e = applyJoinChoice(event, 'm1', 'play', 1e8, T);
    e = applyJoinChoice(e, 'm2', 'play', 1e8, T);
    e = applyJoinChoice(e, 'm1', 'play', 2e8, T2);
    expect(e.registrations.map((r) => [r.memberId, r.enteredPower])).toEqual([
      ['m1', 2e8],
      ['m2', 1e8],
    ]);
  });

  it('"not available" withdraws a self-registration but never a leader one', () => {
    const self = applyJoinChoice(event, 'm1', 'play', 1e8, T);
    expect(applyJoinChoice(self, 'm1', 'none', 1e8, T2).registrations).toEqual([]);
    const leader = { ...event, registrations: [{ memberId: 'm1', source: 'ocr' as const }] };
    expect(applyJoinChoice(leader, 'm1', 'none', 1e8, T2)).toBe(leader);
    expect(choiceOfRegistration(undefined)).toBe('none');
  });
});

describe('power update rule', () => {
  const s = { powerDropTolerancePct: 10, powerRiseTolerancePct: 30 };

  it('applies changes within [-10%, +30%], keeps others pending', () => {
    expect(evaluatePowerUpdate(100e6, 100e6, s)).toBe('unchanged');
    expect(evaluatePowerUpdate(100e6, 90e6, s)).toBe('applied');
    expect(evaluatePowerUpdate(100e6, 130e6, s)).toBe('applied');
    expect(evaluatePowerUpdate(100e6, 89e6, s)).toBe('pending');
    expect(evaluatePowerUpdate(100e6, 131e6, s)).toBe('pending');
    expect(evaluatePowerUpdate(0, 50e6, s)).toBe('applied');
  });

  it('records leader edits and resolves pending changes', () => {
    const before = makeMember({ id: 'm', power: 100e6 });
    expect(leaderPowerChange(before, { ...before }, 'id', T)).toBeNull();
    expect(leaderPowerChange(before, { ...before, power: 120e6 }, 'pc1', T)).toMatchObject({ source: 'leader', status: 'applied', oldPower: 100e6, newPower: 120e6 });
    const pending: PowerChange = { id: 'p', memberId: 'm', oldPower: 100e6, newPower: 300e6, source: 'self', status: 'pending', createdAt: T };
    expect(pendingPowerChangeOf([pending], 'm')).toBe(pending);
    const approved = resolvePowerChange(pending, true, before, 'Leader', T2);
    expect(approved.member!.power).toBe(300e6);
    expect(approved.change).toMatchObject({ status: 'applied', resolvedBy: 'Leader', resolvedAt: T2 });
    const rejected = resolvePowerChange(pending, false, before, 'Leader', T2);
    expect(rejected.member).toBeUndefined();
    expect(rejected.change.status).toBe('rejected');
  });
});

describe('unlisted join requests', () => {
  const input = { name: 'Nëw  Player', power: 90e6, choices: { A: 'play' as const, B: 'none' as const }, weekDate: '2026-10-16' };

  it('merges repeated requests with the same normalised name for the same week', () => {
    const first = upsertUnlistedRequest([], input, 'r1', T);
    expect(first).toMatchObject({ id: 'r1', status: 'pending', name: 'Nëw Player', normalisedName: 'newplayer' });
    const again = upsertUnlistedRequest([first], { ...input, name: 'new player', power: 95e6 }, 'r2', T2);
    expect(again).toMatchObject({ id: 'r1', power: 95e6, updatedAt: T2 });
    const nextWeek = upsertUnlistedRequest([first], { ...input, weekDate: '2026-10-23' }, 'r3', T2);
    expect(nextWeek.id).toBe('r3');
    const resolved = resolveJoinRequest(first, 'approved', 'Leader', T2, 'm9');
    expect(resolved).toMatchObject({ status: 'approved', linkedMemberId: 'm9' });
    expect(pendingJoinRequests([first, resolved, nextWeek]).map((r) => r.id)).toEqual(['r1', 'r3']);
  });

  it('suggests the closest roster names (aliases included)', () => {
    const members = [
      makeMember({ id: 'a', name: 'IronVanguard' }),
      makeMember({ id: 'b', name: 'LunaStrike', aliases: ['lunastryke'] }),
      makeMember({ id: 'c', name: 'Zephyr' }),
    ];
    expect(suggestMembersForName('Iron Vangard', members)[0]!.member.id).toBe('a');
    expect(suggestMembersForName('Luna Stryke', members)[0]).toMatchObject({ member: { id: 'b' }, score: 1 });
    expect(suggestMembersForName('qqqq', members)).toEqual([]);
  });
});
