import { t } from '@/helpers/i18n';
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

  const m = t().account;
  return (
    <>
      <div className="card settings-card">
        <h2 className="card__title">{m.myAccount}</h2>
        <p className="muted small">
          {vm.account?.email} · {vm.account?.role.toUpperCase()}
        </p>
        <form className="field" onSubmit={(e) => void submit(e)}>
          <span className="field__label">{m.newPassword}</span>
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
              {m.changePassword}
            </button>
            <button type="button" className="button button--ghost" onClick={() => void signOut()}>
              {t().common.signOut}
            </button>
          </div>
        </form>
      </div>

      {vm.isAdmin && (
        <div className="card settings-card">
          <h2 className="card__title">{m.accounts}</h2>
          <p className="muted small">{m.accountsHint}</p>
          <ul className="account-list">
            {vm.accounts.map((a) => (
              <li key={a.id} className="account-list__item">
                <span>{a.email}</span>
                <select
                  className="input"
                  aria-label={m.roleOf(a.email)}
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
