/**
 * Composition root: the ONLY place that decides which implementations the app
 * uses. To move to a cloud backend later, create e.g. `createFirestoreRepositories()`
 * implementing `Repositories` (src/data/repositories.ts) and return it here.
 */
import { openSoulDsDatabase } from '@/data/indexeddb/database';
import { createIndexedDbRepositories } from '@/data/indexeddb/IndexedDbRepositories';
import { createInMemoryRepositories } from '@/data/memory/InMemoryRepositories';
import { createId } from '@/helpers/id';
import { createImportService } from '@/services/importService';
import type { AppServices } from '@/viewmodels/AppServicesContext';

export async function createAppServices(): Promise<AppServices> {
  let repos;
  let storageKind: AppServices['storageKind'];
  try {
    repos = createIndexedDbRepositories(await openSoulDsDatabase());
    storageKind = 'indexeddb';
  } catch (error) {
    console.warn('IndexedDB unavailable, falling back to in-memory storage', error);
    repos = createInMemoryRepositories();
    storageKind = 'memory';
  }
  return {
    repos,
    importer: createImportService(),
    now: () => new Date(),
    newId: createId,
    storageKind,
  };
}
