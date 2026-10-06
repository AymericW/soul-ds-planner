import { BottomNav } from '@/components/BottomNav';
import { ToastHost } from '@/components/ToastHost';
import { ROUTES } from '@/constants/routes';
import { HistoryScreen } from '@/screens/HistoryScreen';
import { RosterScreen } from '@/screens/RosterScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { WeeklyEventScreen } from '@/screens/WeeklyEventScreen';
import { useAppServices } from '@/viewmodels/AppServicesContext';
import { useNavigationViewModel } from '@/viewmodels/useNavigationViewModel';
import { useToasts } from '@/viewmodels/ToastContext';

export function App() {
  const { route, navigate } = useNavigationViewModel();
  const { toasts, dismiss } = useToasts();
  const { storageKind } = useAppServices();

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
      {storageKind === 'memory' && (
        <div className="notice notice--warning app-banner" role="status">
          This browser blocks offline storage (private mode?). Changes will be lost when you close the app.
        </div>
      )}
      <main className="app-main">
        {route === ROUTES.event && <WeeklyEventScreen onNavigate={navigate} />}
        {route === ROUTES.roster && <RosterScreen />}
        {route === ROUTES.history && <HistoryScreen />}
        {route === ROUTES.settings && <SettingsScreen />}
      </main>
      <ToastHost toasts={toasts} onDismiss={dismiss} />
      <BottomNav current={route} onNavigate={navigate} />
    </div>
  );
}
