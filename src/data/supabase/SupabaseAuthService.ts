import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { Account, AccountRole } from '@/models/Account';
import { AuthError, type AuthService, type AuthSession } from '../auth';

interface ProfileRow {
  id: string;
  email: string;
  display_name: string;
  role: AccountRole;
  created_at: string;
}

const toSession = (session: Session | null): AuthSession | null =>
  session ? { userId: session.user.id, email: session.user.email ?? '' } : null;

const toAccount = (row: ProfileRow): Account => ({
  id: row.id,
  email: row.email,
  displayName: row.display_name,
  role: row.role,
  createdAt: row.created_at,
});

export function createSupabaseAuthService(client: SupabaseClient): AuthService {
  return {
    async getSession() {
      const { data } = await client.auth.getSession();
      return toSession(data.session);
    },
    onChange(listener) {
      const { data } = client.auth.onAuthStateChange((_event, session) => listener(toSession(session)));
      return () => data.subscription.unsubscribe();
    },
    async signIn(email, password) {
      const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw new AuthError(error.status === 400 ? 'Wrong email or password.' : error.message);
    },
    async signOut() {
      await client.auth.signOut();
    },
    async changePassword(newPassword) {
      const { error } = await client.auth.updateUser({ password: newPassword });
      if (error) throw new AuthError(error.message);
    },
    async getOwnAccount() {
      const { data: userData } = await client.auth.getUser();
      if (!userData.user) return null;
      const { data, error } = await client.from('profiles').select('*').eq('id', userData.user.id).maybeSingle();
      if (error) throw new AuthError(error.message);
      return data ? toAccount(data as ProfileRow) : null;
    },
    async listAccounts() {
      const { data, error } = await client.from('profiles').select('*').order('created_at');
      if (error) throw new AuthError(error.message);
      return ((data ?? []) as ProfileRow[]).map(toAccount);
    },
    async setRole(accountId, role) {
      const { error } = await client.from('profiles').update({ role }).eq('id', accountId);
      if (error) throw new AuthError(error.message);
    },
  };
}
