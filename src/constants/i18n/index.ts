import { en, type Messages } from './en';
import { fr } from './fr';

export type { Messages };

/** Languages of the interface. Add one here and give it a dictionary with the same keys as `en`. */
export const LOCALES = ['en', 'fr'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export const MESSAGES: Readonly<Record<Locale, Messages>> = Object.freeze({ en, fr });
