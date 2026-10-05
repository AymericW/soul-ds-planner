import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@/constants/defaults';
import { createInMemoryRepositories } from '@/data/memory/InMemoryRepositories';
import { mergeWithDefaultSettings } from '@/data/settingsMerge';
import { makeMember } from '../fixtures';

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
