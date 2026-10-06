import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_SETTINGS } from '@/constants/defaults';
import type { Member } from '@/models/Member';
import type { Settings } from '@/models/Settings';
import type { Suspension } from '@/models/Suspension';
import type { WeekEvent } from '@/models/WeekEvent';
import { useAppServices } from './AppServicesContext';

export interface AppDataSnapshot {
  members: Member[];
  events: WeekEvent[];
  suspensions: Suspension[];
  settings: Settings;
}

const EMPTY: AppDataSnapshot = { members: [], events: [], suspensions: [], settings: { ...DEFAULT_SETTINGS } };

/** Loads every collection from the repositories; `reload()` after each write. */
export function useAppData() {
  const { repos } = useAppServices();
  const [data, setData] = useState<AppDataSnapshot>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [members, events, suspensions, settings] = await Promise.all([
        repos.members.list(),
        repos.events.list(),
        repos.suspensions.list(),
        repos.settings.get(),
      ]);
      setData({ members, events, suspensions, settings });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load data.');
    } finally {
      setLoading(false);
    }
  }, [repos]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Other R4s' changes arrive live; bursts of changes are merged into one reload.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = repos.subscribe(() => {
      clearTimeout(timer);
      timer = setTimeout(() => void reload(), 250);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [repos, reload]);

  return { ...data, loading, error, reload };
}
