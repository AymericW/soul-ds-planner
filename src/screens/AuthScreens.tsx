import { t } from '@/helpers/i18n';
import { useState, type FormEvent } from 'react';
import { EmptyState } from '@/components/EmptyState';
import { useAuth } from '@/viewmodels/AuthContext';

export function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(await signIn(email, password));
    setBusy(false);
  };

  const m = t().auth;
  return (
    <section className="screen">
      <form className="card start-card" onSubmit={(e) => void submit(e)}>
        <h1 className="card__title">{m.signIn}</h1>
        <p className="muted">{m.leadershipOnly}</p>
        <label className="field">
          <span className="field__label">{m.email}</span>
          <input className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span className="field__label">{m.password}</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <span className="field__error" role="alert">
            {error}
          </span>
        )}
        <button type="submit" className="button button--primary button--block" disabled={busy || !email || !password}>
          {busy ? m.signingIn : m.signIn}
        </button>
      </form>
    </section>
  );
}

export function AccessPendingScreen() {
  const { account, refresh, signOut } = useAuth();
  const disabled = account?.role === 'disabled';
  const m = t().auth;
  return (
    <section className="screen">
      <EmptyState title={disabled ? m.accountDisabled : m.waitingApproval}>
        <p>{disabled ? m.disabledText : m.pendingText(account?.email ?? m.newUser)}</p>
        <div className="toolbar">
          <button type="button" className="button" onClick={() => void refresh()}>
            {m.checkAgain}
          </button>
          <button type="button" className="button button--ghost" onClick={() => void signOut()}>
            {t().common.signOut}
          </button>
        </div>
      </EmptyState>
    </section>
  );
}

export function BackendErrorScreen() {
  const { error, refresh, signOut } = useAuth();
  return (
    <section className="screen">
      <EmptyState title={t().auth.cannotReach}>
        <p>{error}</p>
        <p className="muted small">{t().auth.setupHint}</p>
        <div className="toolbar">
          <button type="button" className="button" onClick={() => void refresh()}>
            {t().common.retry}
          </button>
          <button type="button" className="button button--ghost" onClick={() => void signOut()}>
            {t().common.signOut}
          </button>
        </div>
      </EmptyState>
    </section>
  );
}

/** Shown when the build has no Supabase project configured. Rendered outside any provider. */
export function SetupNeededScreen() {
  return (
    <main className="app-main">
      <section className="screen">
        <EmptyState title={t().auth.notConfigured}>
          <p>
            {t().auth.notConfiguredBefore} <code>VITE_SUPABASE_URL</code> {t().auth.and} <code>VITE_SUPABASE_ANON_KEY</code> {t().auth.see}{' '}
            <code>.env.example</code>
            {t().auth.rebuild} <code>docs/BACKEND_SETUP.md</code>.
          </p>
        </EmptyState>
      </section>
    </main>
  );
}
