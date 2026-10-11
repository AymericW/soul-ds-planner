/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** Set at build time in vite.config.ts: commit (short SHA, or "local") and build time (ISO). */
declare const __APP_BUILD__: { id: string; time: string };

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}
