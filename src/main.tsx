import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from '@/App';
import { createAppServices } from '@/compositionRoot';
import { themeCssVariables } from '@/constants/theme';
import { AppServicesProvider } from '@/viewmodels/AppServicesContext';
import { ToastProvider } from '@/viewmodels/ToastContext';
import '@/styles/global.css';

for (const [name, value] of Object.entries(themeCssVariables())) {
  document.documentElement.style.setProperty(name, value);
}

registerSW({ immediate: true });

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');
const root = createRoot(container);

void createAppServices().then((services) => {
  root.render(
    <StrictMode>
      <AppServicesProvider services={services}>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AppServicesProvider>
    </StrictMode>,
  );
});
