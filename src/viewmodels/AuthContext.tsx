import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { canAdminister, canEditAllianceData } from '@/domain/accounts/permissions';
import type { Account } from '@/models/Account';
import { useAppServices } from './AppServicesContext';

/**
 * loading   : checking the stored session
 * signedOut : show the login form
 * pending   : signed in, waiting for an R5 to approve the account (or account disabled)
 * ready     : approved R4/R5
 * error     : the backend could not be reached or is not set up
 */
export type AuthStatus = 'loading' | 'signedOut' | 'pending' | 'ready' | 'error';

interface AuthValue {
  status: AuthStatus;
  account: Account | null;
  error: string | null;
  canEdit: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { auth } = useAppServices();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAccount = useCallback(async () => {
    try {
      const own = await auth.getOwnAccount();
      setAccount(own);
      setError(null);
      setStatus(own && canEditAllianceData(own.role) ? 'ready' : 'pending');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your account.');
      setStatus('error');
    }
  }, [auth]);

  useEffect(() => {
    let active = true;
    const apply = (signedIn: boolean) => {
      if (!active) return;
      if (signedIn) void loadAccount();
      else {
        setAccount(null);
        setStatus('signedOut');
      }
    };
    auth
      .getSession()
      .then((session) => apply(Boolean(session)))
      .catch((e: unknown) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : 'Could not reach the server.');
        setStatus('error');
      });
    // Token refreshes also fire this; only react to real sign-in/out transitions.
    let signedIn: boolean | null = null;
    const unsubscribe = auth.onChange((session) => {
      const now = Boolean(session);
      if (now === signedIn) return;
      const first = signedIn === null;
      signedIn = now;
      if (!first) apply(now);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [auth, loadAccount]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      try {
        await auth.signIn(email, password);
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : 'Could not sign in.';
      }
    },
    [auth],
  );

  const signOut = useCallback(() => auth.signOut(), [auth]);

  const value = useMemo<AuthValue>(
    () => ({
      status,
      account,
      error,
      canEdit: canEditAllianceData(account?.role),
      isAdmin: canAdminister(account?.role),
      signIn,
      signOut,
      refresh: loadAccount,
    }),
    [status, account, error, signIn, signOut, loadAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
