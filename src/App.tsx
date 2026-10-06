import { useEffect } from 'react';
import { BottomNav } from '@/components/BottomNav';
import { ToastHost } from '@/components/ToastHost';
import { ROUTES } from '@/constants/routes';
import { AccessPendingScreen, BackendErrorScreen, LoginScreen } from '@/screens/AuthScreens';
import { HistoryScreen } from '@/screens/HistoryScreen';
import { RosterScreen } from '@/screens/RosterScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { WeeklyEventScreen } from '@/screens/WeeklyEventScreen';
import { useAuth } from '@/viewmodels/AuthContext';
import { useNavigationViewModel } from '@/viewmodels/useNavigationViewModel';
import { useToasts } from '@/viewmodels/ToastContext';

export function App() {
  const { route, navigate } = useNavigationViewModel();
  const { toasts, dismiss, notify } = useToasts();
  const { status } = useAuth();

  // Backend failures that no screen handled (e.g. a role removed while the app is open) still reach the user.
  useEffect(() => {
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason: unknown = event.reason;
      notify(`Something went wrong: ${reason instanceof Error ? reason.message : 'unknown error'}`, 'error');
    };
    window.addEventListener('unhandledrejection', onRejection);
    return () => window.removeEventListener('unhandledrejection', onRejection);
  }, [notify]);

  const ready = status === 'ready';

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-header__badge" aria-hidden="true">
          S
        </span>
        <span className="app-header__title">
          Soul <span>DS Planner</span>
        </span>
      </header>
      <main className="app-main">
        {status === 'loading' && <p className="muted">Loading…</p>}
        {status === 'signedOut' && <LoginScreen />}
        {status === 'pending' && <AccessPendingScreen />}
        {status === 'error' && <BackendErrorScreen />}
        {ready && route === ROUTES.event && <WeeklyEventScreen onNavigate={navigate} />}
        {ready && route === ROUTES.roster && <RosterScreen />}
        {ready && route === ROUTES.history && <HistoryScreen />}
        {ready && route === ROUTES.settings && <SettingsScreen />}
      </main>
      <ToastHost toasts={toasts} onDismiss={dismiss} />
      {ready && <BottomNav current={route} onNavigate={navigate} />}
    </div>
  );
}
