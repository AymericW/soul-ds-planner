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

  return (
    <section className="screen">
      <form className="card start-card" onSubmit={(e) => void submit(e)}>
        <h1 className="card__title">Sign in</h1>
        <p className="muted">Leadership only. Ask an R5 to create your account.</p>
        <label className="field">
          <span className="field__label">Email</span>
          <input className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span className="field__label">Password</span>
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
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </section>
  );
}

export function AccessPendingScreen() {
  const { account, refresh, signOut } = useAuth();
  const disabled = account?.role === 'disabled';
  return (
    <section className="screen">
      <EmptyState title={disabled ? 'Account disabled' : 'Waiting for approval'}>
        <p>
          {disabled
            ? 'This account has been disabled. Contact an R5 if this is a mistake.'
            : `You are signed in as ${account?.email ?? 'a new user'}. An R5 must approve your account before you can see alliance data.`}
        </p>
        <div className="toolbar">
          <button type="button" className="button" onClick={() => void refresh()}>
            Check again
          </button>
          <button type="button" className="button button--ghost" onClick={() => void signOut()}>
            Sign out
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
      <EmptyState title="Cannot reach the server">
        <p>{error}</p>
        <p className="muted small">
          If this is a new project, check that the database setup (supabase/migrations) was run. See docs/BACKEND_SETUP.md.
        </p>
        <div className="toolbar">
          <button type="button" className="button" onClick={() => void refresh()}>
            Retry
          </button>
          <button type="button" className="button button--ghost" onClick={() => void signOut()}>
            Sign out
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
        <EmptyState title="Backend not configured">
          <p>
            This app needs a Supabase project. Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> (see{' '}
            <code>.env.example</code>) and rebuild. The full walkthrough is in <code>docs/BACKEND_SETUP.md</code>.
          </p>
        </EmptyState>
      </section>
    </main>
  );
}
