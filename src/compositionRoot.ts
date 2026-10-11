/**
 * Composition root: the ONLY place that decides which implementations the app
 * uses. To change backend, implement `Repositories` (src/data/repositories.ts)
 * and `AuthService` (src/data/auth.ts) and return them here.
 */
import { createLocalAuthService, createSeededLocalRepositories } from '@/data/local/localServices';
import { createSupabaseAuthService } from '@/data/supabase/SupabaseAuthService';
import { createSupabaseClient, type BackendConfig } from '@/data/supabase/client';
import { createSupabaseRepositories } from '@/data/supabase/SupabaseRepositories';
import { createId } from '@/helpers/id';
import { createImportService } from '@/services/importService';
import { createTesseractOcrService } from '@/services/ocrService';
import type { AppServices } from '@/viewmodels/AppServicesContext';

/**
 * Local development (`npm run dev`) runs on stubbed data: in-memory repositories seeded with the
 * demo roster and an always-signed-in R5, so no database is touched. Deployed builds always use
 * Supabase. To develop against the real backend, set VITE_USE_BACKEND=true in .env.local.
 */
export function shouldUseLocalStubs(env: Record<string, string | boolean | undefined> = import.meta.env): boolean {
  return env.DEV === true && env.VITE_USE_BACKEND !== 'true';
}

export async function createLocalAppServices(): Promise<AppServices> {
  const now = () => new Date();
  return {
    repos: await createSeededLocalRepositories(now),
    auth: createLocalAuthService(),
    importer: createImportService(),
    ocr: createTesseractOcrService(),
    now,
    newId: createId,
  };
}

export function createAppServices(config: BackendConfig): AppServices {
  const client = createSupabaseClient(config);
  return {
    repos: createSupabaseRepositories(client),
    auth: createSupabaseAuthService(client),
    importer: createImportService(),
    ocr: createTesseractOcrService(),
    now: () => new Date(),
    newId: createId,
  };
}
