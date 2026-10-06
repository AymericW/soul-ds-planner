import { createContext, useContext, type ReactNode } from 'react';
import type { AuthService } from '@/data/auth';
import type { Repositories } from '@/data/repositories';
import type { ImportService } from '@/services/importService';
import type { OcrService } from '@/services/ocrService';

/** Everything the viewmodels need from the outside world, wired once in src/compositionRoot.ts. */
export interface AppServices {
  repos: Repositories;
  auth: AuthService;
  importer: ImportService;
  ocr: OcrService;
  now: () => Date;
  newId: () => string;
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
