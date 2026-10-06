/**
 * Composition root: the ONLY place that decides which implementations the app
 * uses. To change backend, implement `Repositories` (src/data/repositories.ts)
 * and `AuthService` (src/data/auth.ts) and return them here.
 */
import { createSupabaseAuthService } from '@/data/supabase/SupabaseAuthService';
import { createSupabaseClient, type BackendConfig } from '@/data/supabase/client';
import { createSupabaseRepositories } from '@/data/supabase/SupabaseRepositories';
import { createId } from '@/helpers/id';
import { createImportService } from '@/services/importService';
import { createTesseractOcrService } from '@/services/ocrService';
import type { AppServices } from '@/viewmodels/AppServicesContext';

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
