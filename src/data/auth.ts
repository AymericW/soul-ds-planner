import type { Account } from '@/models/Account';

export interface AuthSession {
  userId: string;
  email: string;
}

/**
 * Authentication + account contracts (the app only talks to this interface).
 * Accounts are invite-only: an R5 creates them in the backend dashboard and
 * approves the role in the app.
 */
export interface AuthService {
  getSession(): Promise<AuthSession | null>;
  /** Calls back on sign-in, sign-out and token refresh. Returns an unsubscribe function. */
  onChange(listener: (session: AuthSession | null) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  changePassword(newPassword: string): Promise<void>;
  /** The signed-in user's own account (null until the backend created it). */
  getOwnAccount(): Promise<Account | null>;
  /** R5 only. */
  listAccounts(): Promise<Account[]>;
  /** R5 only. */
  setRole(accountId: string, role: Account['role']): Promise<void>;
}

export class AuthError extends Error {}
