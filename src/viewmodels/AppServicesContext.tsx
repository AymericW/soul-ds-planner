import { createContext, useContext, type ReactNode } from 'react';
import type { Repositories } from '@/data/repositories';
import type { ImportService } from '@/services/importService';

/** Everything the viewmodels need from the outside world, wired once in src/compositionRoot.ts. */
export interface AppServices {
  repos: Repositories;
  importer: ImportService;
  now: () => Date;
  newId: () => string;
  /** 'memory' means IndexedDB was unavailable: data will not survive a reload. */
  storageKind: 'indexeddb' | 'memory';
}

const AppServicesContext = createContext<AppServices | null>(null);

export function AppServicesProvider({ services, children }: { services: AppServices; children: ReactNode }) {
  return <AppServicesContext.Provider value={services}>{children}</AppServicesContext.Provider>;
}

export function useAppServices(): AppServices {
  const services = useContext(AppServicesContext);
  if (!services) throw new Error('useAppServices must be used inside <AppServicesProvider>');
  return services;
}
