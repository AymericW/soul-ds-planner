import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface BackendConfig {
  url: string;
  anonKey: string;
}

/**
 * Reads the public project settings injected at build time (see .env.example).
 * The anon key is designed to be public: row-level security in the database is
 * what protects the data.
 */
export function readBackendConfig(env: Record<string, string | undefined> = import.meta.env): BackendConfig | null {
  const url = projectOrigin(env.VITE_SUPABASE_URL);
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim();
  return url && anonKey ? { url, anonKey } : null;
}

/** Keeps only the project address, so a pasted ".../rest/v1/" (or a trailing slash) still works. */
function projectOrigin(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function createSupabaseClient(config: BackendConfig): SupabaseClient {
  return createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // The app uses hash routes (#/event); never let the auth library parse the URL hash.
      detectSessionInUrl: false,
    },
  });
}
