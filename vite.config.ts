/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { pwaManifest } from './src/constants/pwa';

/**
 * `VITE_BASE` lets the same build run at the domain root (`/`) or under a
 * GitHub Pages project path (`/<repo>/`). The GitHub Actions workflow sets it
 * automatically from the repository name.
 */
function resolveBase(): string {
  const raw = process.env.VITE_BASE?.trim();
  if (!raw) return '/';
  const withLeading = raw.startsWith('/') ? raw : `/${raw}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

export default defineConfig({
  base: resolveBase(),
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icons/favicon.png', 'icons/apple-touch-icon.png', 'samples/*'],
      manifest: pwaManifest,
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest,csv}'],
        navigateFallback: 'index.html',
        // OCR engine + language data are downloaded on first OCR use; cache them so OCR also works offline afterwards.
        runtimeCaching: [
          {
            urlPattern: ({ url }: { url: URL }) =>
              url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'tessdata.projectnaptha.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'ocr-engine',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
