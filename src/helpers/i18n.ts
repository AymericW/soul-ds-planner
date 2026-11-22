import { DEFAULT_LOCALE, LOCALES, MESSAGES, type Locale, type Messages } from '@/constants/i18n';

/**
 * The interface language. It is a module-level value (not React state) so every layer can read its texts,
 * including the pure domain rules that write reasons and plan texts. The viewmodel `LocaleProvider` owns
 * changes and re-renders the app after `setLocale`.
 */
let current: Locale = DEFAULT_LOCALE;

export function getLocale(): Locale {
  return current;
}

export function setLocale(locale: Locale): void {
  current = locale;
}

/** Texts of the current language: `t().roster.title`. */
export function t(): Messages {
  return MESSAGES[current];
}

/** Texts of a given language (e.g. labels stored in the database that must stay English). */
export function messagesFor(locale: Locale): Messages {
  return MESSAGES[locale];
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** First supported language among the browser's preferred ones ("fr-FR" -> "fr"), else English. */
export function detectLocale(preferred: readonly string[]): Locale {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split(/[-_]/)[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}
