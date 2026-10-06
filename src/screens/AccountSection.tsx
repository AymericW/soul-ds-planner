import { useState, type FormEvent } from 'react';
import { ACCOUNT_ROLES, type AccountRole } from '@/models/Account';
import { useAuth } from '@/viewmodels/AuthContext';
import { MIN_PASSWORD_LENGTH, useAccountViewModel } from '@/viewmodels/useAccountViewModel';

export function AccountSection() {
  const vm = useAccountViewModel();
  const { signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = await vm.changePassword(password);
    setError(result);
    if (!result) setPassword('');
  };

  return (
    <>
      <div className="card settings-card">
        <h2 className="card__title">My account</h2>
        <p className="muted small">
          {vm.account?.email} · {vm.account?.role.toUpperCase()}
        </p>
        <form className="field" onSubmit={(e) => void submit(e)}>
          <span className="field__label">New password</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <span className="field__error">{error}</span>}
          <div className="toolbar">
            <button type="submit" className="button" disabled={!password}>
              Change password
            </button>
            <button type="button" className="button button--ghost" onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        </form>
      </div>

      {vm.isAdmin && (
        <div className="card settings-card">
          <h2 className="card__title">Accounts</h2>
          <p className="muted small">
            Create accounts in the Supabase dashboard (Authentication → Users → Add user), then approve them here. R4 edits alliance data; R5 also
            manages accounts.
          </p>
          <ul className="account-list">
            {vm.accounts.map((a) => (
              <li key={a.id} className="account-list__item">
                <span>{a.email}</span>
                <select
                  className="input"
                  aria-label={`Role of ${a.email}`}
                  value={a.role}
                  disabled={!vm.canEditRole(a)}
                  onChange={(e) => void vm.setRole(a, e.target.value as AccountRole)}
                >
                  {ACCOUNT_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role.toUpperCase()}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
