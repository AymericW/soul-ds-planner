import { themeTokens } from './theme';

export const APP_NAME = 'SOUL DS Registration System';
export const APP_SHORT_NAME = 'SOUL DS';
export const APP_DESCRIPTION =
  'Plan the weekly Desert Storm Team A for the SOUL alliance: registrations, fair rotation, attendance and penalties.';

/** Web app manifest shared by vite.config.ts (vite-plugin-pwa). Paths are relative to the base URL. */
export const pwaManifest = {
  name: APP_NAME,
  short_name: APP_SHORT_NAME,
  description: APP_DESCRIPTION,
  lang: 'en',
  start_url: '.',
  scope: '.',
  display: 'standalone' as const,
  orientation: 'portrait' as const,
  background_color: themeTokens.colorBg,
  theme_color: themeTokens.colorBg,
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};
