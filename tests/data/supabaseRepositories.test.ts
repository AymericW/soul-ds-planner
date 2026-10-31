import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { createSupabaseRepositories } from '@/data/supabase/SupabaseRepositories';

/** Just enough of the query builder for `from(t).select().order().range()`, with PostgREST's 1000-row cap. */
function fakeClient(tables: Record<string, { id: string; data: unknown }[]>) {
  const ranges: [number, number][] = [];
  const client = {
    from: (table: string) => ({
      select: () => ({
        order: () => ({
          range: (from: number, to: number) => {
            ranges.push([from, to]);
            const rows = (tables[table] ?? []).slice(from, Math.min(to + 1, from + 1000));
            return Promise.resolve({ data: rows, error: null });
          },
        }),
      }),
    }),
  };
  return { client: client as unknown as SupabaseClient, ranges };
}

const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `pc-${String(i).padStart(5, '0')}`, data: { id: `pc-${i}` } }));

describe('Supabase repositories', () => {
  it('reads every row of a table larger than one page', async () => {
    const { client, ranges } = fakeClient({ power_changes: rows(2500) });
    const list = await createSupabaseRepositories(client).powerChanges.list();
    expect(list).toHaveLength(2500);
    expect(ranges).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it('stops after one request when the table fits in a page', async () => {
    const { client, ranges } = fakeClient({ members: rows(3) });
    expect(await createSupabaseRepositories(client).members.list()).toHaveLength(3);
    expect(ranges).toHaveLength(1);
  });

  it('asks for one more (empty) page when the row count is an exact multiple of the page size', async () => {
    const { client, ranges } = fakeClient({ join_requests: rows(1000) });
    expect(await createSupabaseRepositories(client).joinRequests.list()).toHaveLength(1000);
    expect(ranges).toHaveLength(2);
  });
});
