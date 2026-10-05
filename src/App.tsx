import { BottomNav } from '@/components/BottomNav';
import { ROUTES } from '@/constants/routes';
import { HistoryScreen } from '@/screens/HistoryScreen';
import { RosterScreen } from '@/screens/RosterScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { WeeklyEventScreen } from '@/screens/WeeklyEventScreen';
import { useNavigationViewModel } from '@/viewmodels/useNavigationViewModel';

export function App() {
  const { route, navigate } = useNavigationViewModel();

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-header__badge" aria-hidden="true">
          SOUL
        </span>
        <span className="app-header__title">DS Registration System</span>
      </header>
      <main className="app-main">
        {route === ROUTES.event && <WeeklyEventScreen />}
        {route === ROUTES.roster && <RosterScreen />}
        {route === ROUTES.history && <HistoryScreen />}
        {route === ROUTES.settings && <SettingsScreen />}
      </main>
      <BottomNav current={route} onNavigate={navigate} />
    </div>
  );
}
