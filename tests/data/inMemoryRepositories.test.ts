import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@/constants/defaults';
import { JOIN_LIMITS } from '@/constants/rules';
import { createInMemoryRepositories } from '@/data/memory/InMemoryRepositories';
import { ConflictError, JoinError } from '@/data/repositories';
import { mergeWithDefaultSettings } from '@/data/settingsMerge';
import { makeFinalisedEvent, makeMember, makeSuspension } from '../fixtures';

describe('repositories (in-memory implementation of the storage contract)', () => {
  it('stores copies, lists, deletes and clears', async () => {
    const repos = createInMemoryRepositories();
    const alpha = makeMember({ id: 'a' });
    await repos.members.save(alpha);
    alpha.name = 'mutated after save';
    expect((await repos.members.get('a'))!.name).toBe('A');
    await repos.members.saveMany([makeMember({ id: 'b' }), makeMember({ id: 'c' })]);
    expect((await repos.members.list()).map((m) => m.id).sort()).toEqual(['a', 'b', 'c']);
    await repos.members.delete('b');
    expect(await repos.members.list()).toHaveLength(2);
    await repos.clearAll();
    expect(await repos.members.list()).toHaveLength(0);
  });

  it('returns default settings until saved, and merges partial stored settings', async () => {
    const repos = createInMemoryRepositories();
    expect(await repos.settings.get()).toEqual(DEFAULT_SETTINGS);
    expect(mergeWithDefaultSettings({ coreStarters: 10 } as never)).toEqual({ ...DEFAULT_SETTINGS, coreStarters: 10 });
  });
});

describe('ensureWeekEvents (same rule as the ensure_week_events database function)', () => {
  it('creates Team A and Team B for the upcoming Friday once', async () => {
    const repos = createInMemoryRepositories({ now: () => new Date('2026-10-11T12:00:00Z') });
    await repos.events.ensureWeekEvents();
    await repos.events.ensureWeekEvents();
    expect((await repos.events.list()).map((e) => e.id).sort()).toEqual(['2026-10-16-A', '2026-10-16-B']);
  });
});

describe('finaliseEvent suspension check', () => {
  it('refuses to overwrite suspensions that changed since they were read', async () => {
    const repos = createInMemoryRepositories();
    const s1 = makeSuspension({ id: 's1', memberId: 'x' });
    await repos.suspensions.saveMany([s1]);
    const event = makeFinalisedEvent('e', '2026-10-16', {}, []);
    await expect(repos.finaliseEvent(event, [], [])).rejects.toBeInstanceOf(ConflictError);
    await repos.finaliseEvent(event, [], [s1]);
    expect(await repos.suspensions.list()).toEqual([]);
  });
});

describe('join gateway (mirrors the join_* database functions)', () => {
  const CODE = 'ABCD2345';
  const A = '2026-10-16-A';
  const B = '2026-10-16-B';
  let clock = new Date('2026-10-12T10:00:00Z');
  let seq = 0;

  async function setup() {
    clock = new Date('2026-10-12T10:00:00Z');
    const repos = createInMemoryRepositories({ now: () => clock, newId: () => `id${++seq}` });
    await repos.members.saveMany([
      makeMember({ id: 'm1', name: 'Alpha', power: 100_000_000 }),
      makeMember({ id: 'm2', name: 'Bravo', power: 100_000_000 }),
      makeMember({ id: 'gone', name: 'Gone', active: false }),
    ]);
    await repos.settings.setJoinCode(CODE);
    return repos;
  }

  it('rejects a wrong code, and every code while none is set', async () => {
    const repos = await setup();
    await expect(repos.join.getRoster('WRONG')).rejects.toMatchObject({ code: 'bad_code' });
    await repos.settings.setJoinCode('');
    await expect(repos.join.getRoster('')).rejects.toBeInstanceOf(JoinError);
  });

  it('lists only active members (id + name) and the events of the upcoming Friday', async () => {
    const repos = await setup();
    const roster = await repos.join.getRoster(CODE.toLowerCase());
    expect(roster.members).toEqual([
      { id: 'm1', name: 'Alpha' },
      { id: 'm2', name: 'Bravo' },
    ]);
    expect(roster.events.map((e) => [e.slot, e.date, e.status])).toEqual([
      ['A', '2026-10-16', 'registration'],
      ['B', '2026-10-16', 'registration'],
    ]);
  });

  it('registers per event, resubmits idempotently and reports the previous answer', async () => {
    const repos = await setup();
    await repos.join.submit(CODE, 'm1', 110_000_000, { A: 'play', B: 'sub' });
    clock = new Date('2026-10-12T11:00:00Z');
    const result = await repos.join.submit(CODE, 'm1', 110_000_000, { A: 'play', B: 'play' });
    expect(result).toEqual({ power: 'unchanged', choices: { A: 'play', B: 'play' } });
    expect((await repos.events.get(A))!.registrations).toEqual([
      { memberId: 'm1', source: 'self', submittedAt: '2026-10-12T11:00:00.000Z', enteredPower: 110_000_000 },
    ]);
    expect((await repos.events.get(B))!.registrations).toHaveLength(1);
    expect(await repos.join.getSubmission(CODE, 'm1')).toEqual({ choices: { A: 'play', B: 'play' }, submittedAt: '2026-10-12T11:00:00.000Z' });
  });

  it('validates the member, the power and the choices', async () => {
    const repos = await setup();
    await expect(repos.join.submit(CODE, 'gone', 1e8, { A: 'play', B: 'none' })).rejects.toMatchObject({ code: 'invalid_member' });
    await expect(repos.join.submit(CODE, 'nobody', 1e8, { A: 'play', B: 'none' })).rejects.toMatchObject({ code: 'invalid_member' });
    await expect(repos.join.submit(CODE, 'm1', 12, { A: 'play', B: 'none' })).rejects.toMatchObject({ code: 'invalid_power' });
    await expect(repos.join.submit(CODE, 'm1', 1e8, { A: 'x' } as never)).rejects.toMatchObject({ code: 'invalid_choices' });
  });

  it('applies the power rule: in range -> roster updated + history; out of range -> pending, roster kept', async () => {
    const repos = await setup();
    expect((await repos.join.submit(CODE, 'm1', 120_000_000, { A: 'play', B: 'none' })).power).toBe('applied');
    expect((await repos.members.get('m1'))!.power).toBe(120_000_000);
    expect((await repos.join.submit(CODE, 'm2', 300_000_000, { A: 'play', B: 'none' })).power).toBe('pending');
    expect((await repos.members.get('m2'))!.power).toBe(100_000_000);
    await repos.join.submit(CODE, 'm2', 310_000_000, { A: 'play', B: 'none' });
    const changes = await repos.powerChanges.list();
    expect(changes.map((c) => [c.memberId, c.status, c.newPower]).sort()).toEqual([
      ['m1', 'applied', 120_000_000],
      ['m2', 'pending', 310_000_000],
    ]);
    // Still registered even though the power waits for review.
    expect((await repos.events.get(A))!.registrations.map((r) => r.memberId)).toEqual(['m1', 'm2']);
  });

  it('rejects self-registration once an event left the registration phase (leader data wins)', async () => {
    const repos = await setup();
    await repos.join.getRoster(CODE);
    const a = (await repos.events.get(A))!;
    await repos.events.save({ ...a, status: 'planned', registrations: [{ memberId: 'm1', source: 'manual' }] });
    await expect(repos.join.submit(CODE, 'm1', 1e8, { A: 'sub', B: 'play' })).rejects.toMatchObject({ code: 'closed' });
    expect((await repos.events.get(B))!.registrations).toEqual([]);
    // "Not available" for the closed event is ignored; B is still open.
    await repos.join.submit(CODE, 'm1', 1e8, { A: 'none', B: 'play' });
    expect((await repos.events.get(A))!.registrations).toEqual([{ memberId: 'm1', source: 'manual' }]);
    expect((await repos.events.get(B))!.registrations.map((r) => r.memberId)).toEqual(['m1']);
  });

  it('rate-limits repeated submissions of one member', async () => {
    const repos = await setup();
    for (let i = 0; i < JOIN_LIMITS.submitsPerMember; i++) await repos.join.submit(CODE, 'm1', 1e8, { A: 'play', B: 'none' });
    await expect(repos.join.submit(CODE, 'm1', 1e8, { A: 'play', B: 'none' })).rejects.toMatchObject({ code: 'rate_limited' });
    clock = new Date(clock.getTime() + JOIN_LIMITS.submitWindowMinutes * 60_000);
    await expect(repos.join.submit(CODE, 'm1', 1e8, { A: 'play', B: 'none' })).resolves.toBeDefined();
  });

  it('stores unlisted requests once per name and week, with name and count limits', async () => {
    const repos = await setup();
    await repos.join.requestUnlisted(CODE, 'New Guy', 90e6, { A: 'play', B: 'sub' });
    await repos.join.requestUnlisted(CODE, 'new  guy', 95e6, { A: 'play', B: 'none' });
    const requests = await repos.joinRequests.list();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ status: 'pending', power: 95e6, weekDate: '2026-10-16', choices: { A: 'play', B: 'none' } });
    await expect(repos.join.requestUnlisted(CODE, '!', 90e6, { A: 'play', B: 'none' })).rejects.toMatchObject({ code: 'invalid_name' });
    await repos.join.requestUnlisted(CODE, 'new guy', 95e6, { A: 'play', B: 'none' });
    await expect(repos.join.requestUnlisted(CODE, 'NEW GUY', 95e6, { A: 'play', B: 'none' })).rejects.toMatchObject({ code: 'rate_limited' });
    // 'New Guy' already counts as 1 pending request; fill up to the cap, one window at a time.
    for (let i = 1; i < JOIN_LIMITS.maxPendingRequests; i++) {
      if (i % JOIN_LIMITS.requestsTotal === 0) clock = new Date(clock.getTime() + JOIN_LIMITS.requestWindowMinutes * 60_000);
      await repos.join.requestUnlisted(CODE, `Player ${i}`, 90e6, { A: 'play', B: 'none' });
    }
    clock = new Date(clock.getTime() + JOIN_LIMITS.requestWindowMinutes * 60_000);
    await expect(repos.join.requestUnlisted(CODE, 'One Too Many', 90e6, { A: 'play', B: 'none' })).rejects.toMatchObject({ code: 'too_many_requests' });
  });

  it('caps NEW unlisted requests across all names per window, but still lets a pending one be updated', async () => {
    const repos = await setup();
    for (let i = 0; i < JOIN_LIMITS.requestsTotal; i++) await repos.join.requestUnlisted(CODE, `Fake ${i}`, 90e6, { A: 'play', B: 'none' });
    await expect(repos.join.requestUnlisted(CODE, 'Fake Extra', 90e6, { A: 'play', B: 'none' })).rejects.toMatchObject({ code: 'rate_limited' });
    await expect(repos.join.requestUnlisted(CODE, 'fake 0', 99e6, { A: 'sub', B: 'none' })).resolves.toBeUndefined();
    clock = new Date(clock.getTime() + JOIN_LIMITS.requestWindowMinutes * 60_000);
    await expect(repos.join.requestUnlisted(CODE, 'Fake Extra', 90e6, { A: 'play', B: 'none' })).resolves.toBeUndefined();
  });

  it('a normal settings save never changes the join code (stale pages cannot revert a rotation)', async () => {
    const repos = await setup();
    const stale = await repos.settings.get();
    await repos.settings.setJoinCode('NEWCODE99');
    await repos.settings.save({ ...stale, joinCode: CODE });
    expect((await repos.settings.get()).joinCode).toBe('NEWCODE99');
    await repos.settings.setJoinCode('');
    await repos.settings.save({ ...stale, joinCode: CODE });
    expect((await repos.settings.get()).joinCode).toBe('');
    await expect(repos.join.getRoster(CODE)).rejects.toMatchObject({ code: 'bad_code' });
  });
});
