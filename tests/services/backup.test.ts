import { describe, expect, it } from 'vitest';
import { buildBackup, parseBackup, rosterToCsv } from '@/services/exportService';
import { parseCsv } from '@/helpers/csv';
import { makeFinalisedEvent, makeMember, makeSettings } from '../fixtures';

describe('backup export / import', () => {
  it('round-trips a backup', () => {
    const backup = buildBackup(
      { members: [makeMember({ id: 'a', aliases: ['x'] })], events: [makeFinalisedEvent('e1', '2026-01-01', { a: 'core' }, ['a'])], suspensions: [], settings: makeSettings() },
      '2026-01-02T00:00:00.000Z',
    );
    const restored = parseBackup(JSON.stringify(backup));
    expect(restored).toEqual(backup);
  });

  it('rejects files that are not backups', () => {
    expect(() => parseBackup('not json')).toThrow('not valid JSON');
    expect(() => parseBackup('{"app":"other"}')).toThrow('not a SOUL DS backup');
    expect(() => parseBackup('{"app":"soul-ds-planner","formatVersion":99}')).toThrow('newer version');
    expect(() => parseBackup('{"app":"soul-ds-planner","formatVersion":1,"members":[],"events":[]}')).toThrow('missing "suspensions"');
  });

  it('exports the roster as CSV with stats', () => {
    const csv = rosterToCsv([makeMember({ id: 'a', name: 'Alpha, the 1st', power: 123 })], new Map());
    const rows = parseCsv(csv);
    expect(rows[0]![0]).toBe('Name');
    expect(rows[1]!.slice(0, 5)).toEqual(['Alpha, the 1st', '123', '3', '', 'yes']);
  });
});
