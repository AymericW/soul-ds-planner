import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEMO_ROSTER } from '@/data/demo/demoRoster';
import { foldOcrConfusions, levenshtein, similarity } from '@/helpers/fuzzy';
import { cleanOcrLine, guessNameFromLine, matchOcrText, type NameCandidate } from '@/helpers/nameMatching';
import { normaliseName } from '@/helpers/normalise';

const fixture = (name: string) => readFileSync(resolve(process.cwd(), 'tests/fixtures', name), 'utf8');
const demoCandidates: NameCandidate[] = DEMO_ROSTER.map((m) => ({ id: m.name, name: m.name, aliases: [] }));
const ids = (r: ReturnType<typeof matchOcrText>) => r.matches.map((m) => m.memberId);

describe('fuzzy primitives', () => {
  it('computes edit distance and similarity', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('', 'abc')).toBe(3);
    expect(similarity('nightowl', 'nightow')).toBeCloseTo(0.875, 3);
    expect(similarity('abc', 'abc')).toBe(1);
  });

  it('normalises names (case, accents, symbols) and folds OCR confusions', () => {
    expect(normaliseName('  Dräg0n_Slayer ★ ')).toBe('drag0nslayer');
    expect(normaliseName('Ñova')).toBe('nova');
    expect(foldOcrConfusions('gr1mreaper')).toBe(foldOcrConfusions('grimreaper'));
    expect(foldOcrConfusions('s0ul')).toBe('soul');
  });

  it('cleans tags, numbers and times from OCR lines but keeps digits inside names', () => {
    expect(cleanOcrLine('@ [SOUL] Orion77 639 pts')).toBe('@ Orion77 pts');
    expect(cleanOcrLine('(sout) Kael_7 12.5M 21:04')).toBe('Kael_7');
  });

  it('guesses the name part of an unrecognised line, ignoring UI sentences', () => {
    expect(guessNameFromLine('C=) Stranger99 v Yes')).toBe('Stranger99');
    expect(guessNameFromLine('Option: Yes, | will join - 34 votes')).toBeNull();
  });
});

describe('matchOcrText on real Tesseract output (sample poll screenshot)', () => {
  it('finds every voter despite OCR mistakes (lronVanguard, GrimReaper, Nightow!, sow orion77)', () => {
    const result = matchOcrText(fixture('ocr-demo-poll.txt'), demoCandidates);
    const expected = ['IronVanguard', 'LunaStrike', 'Kael_7', 'NovaBlade', 'GoldenHawk', 'ShadowFox', 'Valkyra', 'RexTitan', 'SilentArrow', 'Brutus', 'CrimsonOwl', 'Zephyr', 'MadMaxine', 'Orion77', 'PixelPaladin', 'Thunderjaw', 'Ember', 'FrostByte', 'Gr1mReaper', 'HelixQueen', 'Jaguar', 'Kraken', 'LadyLuck', 'Mercury', 'NightOwl', 'Odin', 'Phoenix', 'QuietStorm', 'Ronin', 'Saber', 'Tempest', 'Ursa', 'Viper'];
    expect(ids(result)).toEqual(expected);
    // no false positives such as "Paladin" (inside PixelPaladin) or "Ñova" (inside NovaBlade)
    expect(ids(result)).not.toContain('Paladin');
    expect(ids(result)).not.toContain('Ñova');
    expect(result.unmatched.map((u) => u.guess)).toEqual(['Stranger99']);
  });

  it('matches the participation screenshot', () => {
    const result = matchOcrText(fixture('ocr-demo-attendance.txt'), demoCandidates);
    expect(result.matches).toHaveLength(20);
    expect(ids(result)).toContain('Gr1mReaper');
    expect(result.unmatched).toEqual([]);
  });
});

describe('matchOcrText rules', () => {
  const roster: NameCandidate[] = [
    { id: 'a', name: 'Odin', aliases: [] },
    { id: 'b', name: 'Eagle Eye', aliases: [] },
    { id: 'c', name: 'Xx_Shadow_xX', aliases: ['shad0wking'] },
    { id: 'd', name: 'Thunderjaw', aliases: [] },
  ];

  it('requires near-exact matches for short names', () => {
    expect(ids(matchOcrText('Odin', roster))).toEqual(['a']);
    expect(ids(matchOcrText('Odim', roster))).toEqual([]);
  });

  it('matches names containing spaces and remembered aliases', () => {
    const result = matchOcrText('Eagle Eye\nShad0wKing', roster);
    expect(ids(result)).toEqual(['b', 'c']);
    expect(result.matches[1]!.via).toBe('alias');
  });

  it('finds several members on one merged line, each word used once', () => {
    expect(ids(matchOcrText('Thunderjaw 120 Odin 98', roster)).sort()).toEqual(['a', 'd']);
  });

  it('tolerates typical OCR errors on longer names', () => {
    expect(ids(matchOcrText('Thunderiaw', roster))).toEqual(['d']);
    expect(ids(matchOcrText('Thundrjaw', roster))).toEqual(['d']);
    expect(ids(matchOcrText('Thunder', roster))).toEqual([]);
  });

  it('returns each member once with its best line', () => {
    const result = matchOcrText('Thundrjaw\nThunderjaw', roster);
    expect(result.matches).toEqual([{ memberId: 'd', line: 'Thunderjaw', score: 1, via: 'name' }]);
  });
});

describe('accented and special-character names (French poll screenshot)', () => {
  const roster = [
    { id: '1', name: 'Klügán', aliases: [] },
    { id: '2', name: 'Jåde', aliases: [] },
    { id: '3', name: 'MegaDiridi1', aliases: [] },
  ];
  it('matches names whatever accents the OCR keeps or drops', () => {
    const text = 'R4 Klugan\nPuissance :214946121 LV.35\nR3 Jade\nR2 d MegaDiridi1';
    const ids = matchOcrText(text, roster).matches.map((m) => m.memberId);
    expect(ids).toEqual(['1', '2', '3']);
  });
  it('does not offer French UI text as unmatched names', () => {
    const { unmatched } = matchOcrText('Puissance :191024091 LV.34\nMEMBRES VOTANTS', roster);
    expect(unmatched).toEqual([]);
  });
});

it('ignores the French header sentence', () => {
  const text = "Les membres suivants ont choisi l'option 3 lors de ce vote";
  expect(matchOcrText(text, [{ id: '1', name: 'Klügán', aliases: [] }]).unmatched).toEqual([]);
});

it('matches Jåde when OCR returns an icon glyph glued to a misread vowel', () => {
  const r = matchOcrText('BH = ÆJède\nPuissance :239694217 LV.35', [{ id: '1', name: 'Jåde', aliases: [] }]);
  expect(r.matches.map((m) => m.memberId)).toEqual(['1']);
});
