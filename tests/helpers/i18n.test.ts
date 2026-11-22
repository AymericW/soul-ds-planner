import { afterEach, describe, expect, it } from 'vitest';
import { MESSAGES } from '@/constants/i18n';
import { defaultEventLabel, formatEventDate, formatWeekday } from '@/helpers/dates';
import { formatDuration, formatWeeksAgo } from '@/helpers/format';
import { detectLocale, getLocale, isLocale, setLocale, t } from '@/helpers/i18n';
import { validateMemberDraft } from '@/domain/roster/memberRules';

afterEach(() => setLocale('en'));

/** Every leaf path of a dictionary, e.g. "week.title" (functions and arrays count as leaves). */
function keysOf(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([k, v]) => keysOf(v, prefix ? `${prefix}.${k}` : k));
}

describe('language detection', () => {
  it('picks the first supported browser language', () => {
    expect(detectLocale(['fr-FR', 'en-US'])).toBe('fr');
    expect(detectLocale(['de-DE', 'fr'])).toBe('fr');
    expect(detectLocale(['en-GB'])).toBe('en');
  });

  it('falls back to English', () => {
    expect(detectLocale([])).toBe('en');
    expect(detectLocale(['de', 'es-ES'])).toBe('en');
  });

  it('recognises supported codes only', () => {
    expect(isLocale('fr')).toBe(true);
    expect(isLocale('de')).toBe(false);
    expect(isLocale(null)).toBe(false);
  });
});

describe('dictionaries', () => {
  it('French has exactly the English keys', () => {
    expect(keysOf(MESSAGES.fr).sort()).toEqual(keysOf(MESSAGES.en).sort());
  });

  it('defaults to English', () => {
    expect(getLocale()).toBe('en');
    expect(t().nav.roster).toBe('Roster');
  });
});

describe('French formatting', () => {
  it('formats dates, durations and weeks in French', () => {
    setLocale('fr');
    expect(formatEventDate('2026-10-16')).toBe('ven. 16 oct. 2026');
    expect(formatWeekday('2026-10-14')).toBe('mer.');
    expect(formatDuration((2 * 24 * 60 + 5 * 60) * 60_000)).toBe('2 j 5 h');
    expect(formatWeeksAgo(null)).toBe('jamais');
    expect(formatWeeksAgo(1)).toBe('il y a 1 semaine');
    expect(formatWeeksAgo(3)).toBe('il y a 3 semaines');
  });

  it('keeps the stored event label in English (the database builds the same one)', () => {
    setLocale('fr');
    expect(defaultEventLabel('2026-10-16', 'A')).toBe('Desert Storm Team A – Fri 16 Oct 2026');
  });

  it('rule messages follow the language', () => {
    setLocale('fr');
    expect(validateMemberDraft({ name: '', power: 1, activity: 3, active: true }, []).name).toBe('Le nom est obligatoire.');
    setLocale('en');
    expect(validateMemberDraft({ name: '', power: 1, activity: 3, active: true }, []).name).toBe('Name is required.');
  });
});
