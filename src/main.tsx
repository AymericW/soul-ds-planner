import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/App';
import { createAppServices, createLocalAppServices, shouldUseLocalStubs } from '@/compositionRoot';
import { themeCssVariables } from '@/constants/theme';
import { readBackendConfig } from '@/data/supabase/client';
import { SetupNeededScreen } from '@/screens/AuthScreens';
import { startAppUpdates } from '@/services/appUpdate';
import { AppServicesProvider } from '@/viewmodels/AppServicesContext';
import { AuthProvider } from '@/viewmodels/AuthContext';
import { ToastProvider } from '@/viewmodels/ToastContext';
import '@/styles/global.css';

for (const [name, value] of Object.entries(themeCssVariables())) {
  document.documentElement.style.setProperty(name, value);
}

startAppUpdates();

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');
const root = createRoot(container);

const config = readBackendConfig();
// Created once, outside React, so StrictMode's double render never opens two backend clients.
const services = shouldUseLocalStubs() ? await createLocalAppServices() : config ? createAppServices(config) : null;

root.render(
  <StrictMode>
    {services ? (
      <AppServicesProvider services={services}>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </AppServicesProvider>
    ) : (
      <SetupNeededScreen />
    )}
  </StrictMode>,
);
