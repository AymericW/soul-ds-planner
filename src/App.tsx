import { useEffect } from 'react';
import { BottomNav } from '@/components/BottomNav';
import { BackIcon } from '@/components/Icons';
import { ToastHost } from '@/components/ToastHost';
import { ROUTES } from '@/constants/routes';
import { t } from '@/helpers/i18n';
import { AccessPendingScreen, BackendErrorScreen, LoginScreen } from '@/screens/AuthScreens';
import { HistoryScreen } from '@/screens/HistoryScreen';
import { JoinScreen } from '@/screens/JoinScreen';
import { RequestsScreen } from '@/screens/RequestsScreen';
import { RosterScreen } from '@/screens/RosterScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { WeeklyEventScreen } from '@/screens/WeeklyEventScreen';
import { useAuth } from '@/viewmodels/AuthContext';
import { useLocale } from '@/viewmodels/LocaleContext';
import { useNavigationViewModel } from '@/viewmodels/useNavigationViewModel';
import { usePendingRequestCount } from '@/viewmodels/useRequestsViewModel';
import { useToasts } from '@/viewmodels/ToastContext';

/** A language switch remounts the app so every text (memoised ones included) is rebuilt in the new language. */
export function LocalizedApp() {
  const { locale } = useLocale();
  return <App key={locale} />;
}

export function App() {
  const { route, navigate } = useNavigationViewModel();
  const { toasts, dismiss, notify } = useToasts();
  const { status } = useAuth();
  const { locale, setLocale } = useLocale();
  // The join page is public: it renders outside the login gate and without the leaders' navigation.
  const isJoin = route === ROUTES.join;
  const ready = status === 'ready' && !isJoin;
  const pendingRequests = usePendingRequestCount(ready, route);

  // Backend failures that no screen handled (e.g. a role removed while the app is open) still reach the user.
  useEffect(() => {
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason: unknown = event.reason;
      notify(t().common.somethingWrong(reason instanceof Error ? reason.message : t().common.unknownError), 'error');
    };
    window.addEventListener('unhandledrejection', onRejection);
    return () => window.removeEventListener('unhandledrejection', onRejection);
  }, [notify]);

  return (
    <div className={`app${isJoin ? ' app--public' : ''}`}>
      <header className="app-header">
        <span className="app-header__badge" aria-hidden="true">
          S
        </span>
        <span className="app-header__title">
          Soul <span>DS Planner</span>
        </span>
        <button
          type="button"
          className="app-header__lang"
          lang={locale === 'fr' ? 'en' : 'fr'}
          aria-label={t().language.switchAria}
          title={t().language.switchAria}
          onClick={() => setLocale(locale === 'fr' ? 'en' : 'fr')}
        >
          {t().language.switchShort}
        </button>
      </header>
      <main className="app-main">
        {isJoin ? (
          <>
            {status === 'ready' && (
              <button type="button" className="button button--ghost button--small back-link" onClick={() => navigate(ROUTES.event)}>
                <BackIcon size={18} /> {t().app.backToApp}
              </button>
            )}
            <JoinScreen />
          </>
        ) : (
          <>
            {status === 'loading' && <p className="muted">{t().common.loading}</p>}
            {status === 'signedOut' && <LoginScreen />}
            {status === 'pending' && <AccessPendingScreen />}
            {status === 'error' && <BackendErrorScreen />}
            {ready && route === ROUTES.event && <WeeklyEventScreen onNavigate={navigate} />}
            {ready && route === ROUTES.roster && <RosterScreen />}
            {ready && route === ROUTES.requests && <RequestsScreen />}
            {ready && route === ROUTES.history && <HistoryScreen />}
            {ready && route === ROUTES.settings && <SettingsScreen />}
          </>
        )}
      </main>
      <ToastHost toasts={toasts} onDismiss={dismiss} />
      {ready && <BottomNav current={route} onNavigate={navigate} badges={{ [ROUTES.requests]: pendingRequests }} />}
    </div>
  );
}
