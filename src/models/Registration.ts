/** ocr: poll screenshot · manual: ticked by an R4 · self: submitted by the player on the public join page. */
export type RegistrationSource = 'ocr' | 'manual' | 'self';

/** A member who voted "yes" in the weekly poll (or registered themselves). */
export interface Registration {
  memberId: string;
  source: RegistrationSource;
  /** The member only offered to be a substitute: never considered for a starter slot. */
  substituteOnly?: boolean;
  /** Self-registrations: when the player submitted the join form (ISO timestamp). */
  submittedAt?: string;
  /** Self-registrations: the power the player entered (raw number). */
  enteredPower?: number;
}
