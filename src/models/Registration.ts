export type RegistrationSource = 'ocr' | 'manual';

/** A member who voted "yes" in the weekly poll. */
export interface Registration {
  memberId: string;
  source: RegistrationSource;
}
