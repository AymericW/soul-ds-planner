import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Locale } from '@/constants/i18n';
import { UI_STORAGE_KEYS } from '@/constants/storageKeys';
import { detectLocale, getLocale, isLocale, setLocale as applyLocale } from '@/helpers/i18n';

function readStoredLocale(): Locale | null {
  try {
    const value = localStorage.getItem(UI_STORAGE_KEYS.locale);
    return isLocale(value) ? value : null;
  } catch {
    return null;
  }
}

function applyToDocument(locale: Locale) {
  applyLocale(locale);
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
}

/**
 * Picks the interface language before the first render: the one chosen with the header switch,
 * otherwise the browser's preferred language (French or English, English by default).
 */
export function initLocale(): Locale {
  const preferred = typeof navigator === 'undefined' ? [] : (navigator.languages?.length ? navigator.languages : [navigator.language]);
  const locale = readStoredLocale() ?? detectLocale(preferred.filter(Boolean));
  applyToDocument(locale);
  return locale;
}

interface LocaleValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setState] = useState<Locale>(getLocale);

  const setLocale = useCallback((next: Locale) => {
    applyToDocument(next);
    try {
      localStorage.setItem(UI_STORAGE_KEYS.locale, next);
    } catch {
      /* preference only */
    }
    setState(next);
  }, []);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleValue {
  const value = useContext(LocaleContext);
  if (!value) throw new Error('useLocale must be used inside <LocaleProvider>');
  return value;
}
