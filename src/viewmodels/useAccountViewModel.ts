import { useCallback, useEffect, useState } from 'react';
import { canChangeRole } from '@/domain/accounts/permissions';
import type { Account, AccountRole } from '@/models/Account';
import { useAppServices } from './AppServicesContext';
import { useAuth } from './AuthContext';
import { useToasts } from './ToastContext';

export const MIN_PASSWORD_LENGTH = 8;

/** Own account (change password) and, for R5, the list of accounts with their roles. */
export function useAccountViewModel() {
  const { auth } = useAppServices();
  const { account, isAdmin } = useAuth();
  const { notify } = useToasts();
  const [accounts, setAccounts] = useState<Account[]>([]);

  const loadAccounts = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setAccounts(await auth.listAccounts());
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not load accounts.', 'error');
    }
  }, [auth, isAdmin, notify]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const changePassword = useCallback(
    async (password: string): Promise<string | null> => {
      if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
      try {
        await auth.changePassword(password);
        notify('Password changed.', 'success');
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : 'Could not change the password.';
      }
    },
    [auth, notify],
  );

  const setRole = useCallback(
    async (target: Account, role: AccountRole) => {
      try {
        await auth.setRole(target.id, role);
        notify(`${target.email} is now ${role.toUpperCase()}.`, 'success');
      } catch (e) {
        notify(e instanceof Error ? e.message : 'Could not change the role.', 'error');
      }
      await loadAccounts();
    },
    [auth, loadAccounts, notify],
  );

  const canEditRole = useCallback(
    (target: Account) => account !== null && canChangeRole(account.id, target.id, account.role),
    [account],
  );

  return { account, isAdmin, accounts, changePassword, setRole, canEditRole };
}
