import { registerSW } from 'virtual:pwa-register';

/**
 * Keeps the installed app (PWA) up to date.
 *
 * The service worker only looks for a new version when the app is loaded, and installed apps
 * (Android Chrome, iOS home screen) can stay open in the background for days. So we also check
 * whenever the app comes back to the foreground and every 30 minutes. With `registerType:
 * 'autoUpdate'` a new version activates by itself and the page reloads into it.
 */

const CHECK_INTERVAL_MS = 30 * 60 * 1000;
/** If a found update has not reloaded the page by then, reload anyway. */
const RELOAD_FALLBACK_MS = 8000;

let registration: ServiceWorkerRegistration | undefined;

export function startAppUpdates(): void {
  registerSW({
    immediate: true,
    onRegisteredSW(_url, reg) {
      registration = reg;
      if (!reg) return;
      // A version downloaded earlier may still be waiting (service workers built before skipWaiting was on).
      activateWaiting(reg);
      setInterval(() => void checkQuietly(), CHECK_INTERVAL_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void checkQuietly();
      });
    },
  });
}

async function checkQuietly(): Promise<void> {
  if (!registration || !navigator.onLine) return;
  try {
    await registration.update();
  } catch {
    // Offline or server hiccup: the next check will try again.
  }
}

export type UpdateCheckResult = 'updating' | 'latest' | 'unsupported';

/**
 * Asks the server for a new version. 'updating': one was found and the page is about to reload
 * into it. 'latest': nothing new. 'unsupported': no service worker (dev server, private mode…).
 * Throws when the server cannot be reached.
 */
export async function checkForUpdates(): Promise<UpdateCheckResult> {
  if (!registration) return 'unsupported';
  await registration.update();
  if (registration.installing || registration.waiting) {
    activateWaiting(registration);
    setTimeout(() => window.location.reload(), RELOAD_FALLBACK_MS);
    return 'updating';
  }
  return 'latest';
}

/** Tells a waiting service worker to take over, then reloads into the new version. */
function activateWaiting(reg: ServiceWorkerRegistration): void {
  const waiting = reg.waiting;
  if (!waiting || !navigator.serviceWorker.controller) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
  waiting.postMessage({ type: 'SKIP_WAITING' });
}

/**
 * Last resort for an app stuck on an old version: drops this app's service worker and its saved
 * copy of the app, then reloads from the network. The login (stored separately) is kept, and so
 * is the downloaded OCR engine.
 */
export async function resetAppFiles(): Promise<void> {
  try {
    const scope = registration?.scope ?? new URL(import.meta.env.BASE_URL, window.location.href).href;
    const regs = await navigator.serviceWorker?.getRegistrations();
    await Promise.all((regs ?? []).filter((r) => r.scope === scope).map((r) => r.unregister()));
    if ('caches' in window) {
      const names = await caches.keys();
      // Workbox names the app's precache after the scope; other projects on the same origin are left alone.
      await Promise.all(names.filter((n) => n.includes(scope)).map((n) => caches.delete(n)));
    }
  } finally {
    window.location.reload();
  }
}

/** Build shown to users, e.g. "11 Oct 2026, 19:58 · cc796a9". */
export function appBuildLabel(): string {
  const time = new Date(__APP_BUILD__.time);
  const date = Number.isNaN(time.getTime())
    ? __APP_BUILD__.time
    : time.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return `${date} · ${__APP_BUILD__.id}`;
}
