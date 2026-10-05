import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from '@/App';
import { themeCssVariables } from '@/constants/theme';
import '@/styles/global.css';

for (const [name, value] of Object.entries(themeCssVariables())) {
  document.documentElement.style.setProperty(name, value);
}

registerSW({ immediate: true });

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
