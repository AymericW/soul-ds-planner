import { describe, expect, it } from 'vitest';
import { parseCsv } from '@/helpers/csv';
import { parseActiveFlag, parseRank, parseRosterTable } from '@/services/rosterTableParser';

describe('parseRosterTable (CSV import parsing)', () => {
  it('maps flexible headers in any order and parses values', () => {
    const csv = 'Player Name;Activity Rating (1-5);Total Power;Role;Status\nAlpha;4;152,3M;r4;yes\nBravo;2;98.5;;no\n';
    const result = parseRosterTable(parseCsv(csv));
    expect(result.columnMap).toEqual({
      name: 'Player Name',
      activity: 'Activity Rating (1-5)',
      power: 'Total Power',
      rank: 'Role',
      active: 'Status',
    });
    expect(result.issues).toEqual([]);
    expect(result.rows).toEqual([
      { rowNumber: 2, name: 'Alpha', activity: 4, power: 152_300_000, rank: 'R4', active: true },
      { rowNumber: 3, name: 'Bravo', activity: 2, power: 98_500_000, active: false },
    ]);
  });

  it('works with only a name column (optional columns stay undefined)', () => {
    const result = parseRosterTable(parseCsv('member\nAlpha\n  Bravo   Two \n'));
    expect(result.rows).toEqual([
      { rowNumber: 2, name: 'Alpha' },
      { rowNumber: 3, name: 'Bravo Two' },
    ]);
  });

  it('finds the header below title rows', () => {
    const table = [['SOUL roster export'], [''], ['Name', 'Power', 'Activity'], ['Alpha', '100M', '5']];
    const result = parseRosterTable(table);
    expect(result.rows).toEqual([{ rowNumber: 4, name: 'Alpha', power: 100_000_000, activity: 5 }]);
  });

  it('falls back to positional columns without a header', () => {
    const result = parseRosterTable([['Alpha', '120M', '3', 'R2', 'yes']]);
    expect(result.rows).toEqual([{ rowNumber: 1, name: 'Alpha', power: 120_000_000, activity: 3, rank: 'R2', active: true }]);
  });

  it('reports invalid cells without dropping the row', () => {
    const result = parseRosterTable(parseCsv('name,power,activity,rank,active\nAlpha,lots,9,boss,maybe\n,100M,3,,\n'));
    expect(result.rows).toEqual([{ rowNumber: 2, name: 'Alpha' }]);
    expect(result.issues.map((i) => i.rowNumber)).toEqual([2, 2, 2, 2, 3]);
    expect(result.issues[0]!.message).toContain('power');
    expect(result.issues[4]!.message).toContain('Missing name');
  });

  it('parses rank and active flags', () => {
    expect(parseRank('4')).toBe('R4');
    expect(parseRank(' r5 ')).toBe('R5');
    expect(parseRank('R9')).toBeUndefined();
    expect(parseActiveFlag('Yes')).toBe(true);
    expect(parseActiveFlag('0')).toBe(false);
    expect(parseActiveFlag('')).toBeUndefined();
  });
});
