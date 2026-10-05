import { describe, expect, it } from 'vitest';
import { detectDelimiter, parseCsv, toCsv } from '@/helpers/csv';

describe('parseCsv', () => {
  it('parses simple comma separated rows and skips blank lines', () => {
    expect(parseCsv('name,power\nAlpha,120M\n\nBravo,95.5M\n')).toEqual([
      ['name', 'power'],
      ['Alpha', '120M'],
      ['Bravo', '95.5M'],
    ]);
  });

  it('handles quoted fields with delimiters, quotes and newlines', () => {
    const csv = 'name,notes\r\n"Smith, John","said ""hi""\nthen left"\r\n';
    expect(parseCsv(csv)).toEqual([
      ['name', 'notes'],
      ['Smith, John', 'said "hi"\nthen left'],
    ]);
  });

  it('auto-detects semicolon and tab delimiters (European Excel exports)', () => {
    expect(detectDelimiter('Name;Power;Activity\nA;1;2')).toBe(';');
    expect(detectDelimiter('Name\tPower\nA\t1')).toBe('\t');
    expect(parseCsv('Name;Power\nÉlise;152,3M')).toEqual([
      ['Name', 'Power'],
      ['Élise', '152,3M'],
    ]);
  });

  it('strips a UTF-8 BOM', () => {
    expect(parseCsv('﻿name\nA')[0]).toEqual(['name']);
  });

  it('round-trips through toCsv', () => {
    const rows = [['a', 'b,c', 'd"e'], ['1', '', 'x\ny']];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});
