import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_SETTINGS } from '@/constants/defaults';
import { computeRosterStats } from '@/domain/history/memberStats';
import { validateSettings, weightsFromPowerPercent, type SettingsErrors } from '@/domain/settings/settingsRules';
import { registrationCap } from '@/domain/selection/runSelection';
import { toIsoDate } from '@/helpers/dates';
import type { BackupFile } from '@/models/Backup';
import type { Settings } from '@/models/Settings';
import { buildBackup, downloadTextFile, InvalidBackupError, parseBackup, rosterToCsv } from '@/services/exportService';
import { useAppServices } from './AppServicesContext';
import { useAppData } from './useAppData';
import { useDemoData } from './useDemoData';
import { useToasts } from './ToastContext';

export interface PendingRestore {
  fileName: string;
  backup: BackupFile;
}

export function useSettingsViewModel() {
  const { repos, now, storageKind } = useAppServices();
  const { notify } = useToasts();
  const data = useAppData();
  const { settings, members, events, suspensions, reload } = data;

  const [draft, setDraft] = useState<Settings>(settings);
  const [pendingRestore, setPendingRestore] = useState<PendingRestore | null>(null);

  // Load stored settings into the form once they arrive / after a restore.
  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const errors: SettingsErrors = useMemo(() => validateSettings(draft), [draft]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);
  const cap = registrationCap(draft);
  const powerPercent = Math.round((draft.weights.power / (draft.weights.power + draft.weights.activity || 1)) * 100);

  const setCount = useCallback(
    (field: 'coreStarters' | 'rotationStarters' | 'substitutes' | 'suspensionEvents', value: number) =>
      setDraft((d) => ({ ...d, [field]: value })),
    [],
  );
  const setPowerPercent = useCallback((p: number) => setDraft((d) => ({ ...d, weights: weightsFromPowerPercent(p) })), []);
  const setScoreEpsilon = useCallback((v: number) => setDraft((d) => ({ ...d, scoreEpsilon: v })), []);

  const save = useCallback(async () => {
    if (Object.keys(validateSettings(draft)).length) return;
    await repos.settings.save(draft);
    await reload();
    notify('Settings saved. They apply from the next selection run.', 'success');
  }, [draft, repos, reload, notify]);

  const discardChanges = useCallback(() => setDraft(settings), [settings]);
  const restoreDefaults = useCallback(() => setDraft({ ...DEFAULT_SETTINGS, weights: { ...DEFAULT_SETTINGS.weights } }), []);

  const exportBackup = useCallback(() => {
    const backup = buildBackup({ members, events, suspensions, settings }, now().toISOString());
    downloadTextFile(`soul-ds-backup-${toIsoDate(now())}.json`, JSON.stringify(backup, null, 2), 'application/json');
    notify('Backup downloaded. Keep it somewhere safe (e.g. cloud drive).', 'success');
  }, [members, events, suspensions, settings, now, notify]);

  const exportRoster = useCallback(() => {
    const stats = computeRosterStats(members, events, suspensions);
    const sorted = [...members].sort((a, b) => a.name.localeCompare(b.name));
    downloadTextFile(`soul-roster-${toIsoDate(now())}.csv`, rosterToCsv(sorted, stats), 'text/csv;charset=utf-8');
  }, [members, events, suspensions, now]);

  const chooseBackupFile = useCallback(
    async (file: File) => {
      try {
        setPendingRestore({ fileName: file.name, backup: parseBackup(await file.text()) });
      } catch (e) {
        notify(e instanceof InvalidBackupError ? e.message : 'Could not read this file.', 'error');
      }
    },
    [notify],
  );

  const confirmRestore = useCallback(async () => {
    if (!pendingRestore) return;
    const { backup } = pendingRestore;
    await repos.clearAll();
    await repos.members.replaceAll(backup.members);
    await repos.events.replaceAll(backup.events);
    await repos.suspensions.replaceAll(backup.suspensions);
    await repos.settings.save(backup.settings);
    setPendingRestore(null);
    await reload();
    notify(`Backup restored: ${backup.members.length} members, ${backup.events.length} events.`, 'success');
  }, [pendingRestore, repos, reload, notify]);

  const cancelRestore = useCallback(() => setPendingRestore(null), []);

  const resetAllData = useCallback(async () => {
    await repos.clearAll();
    await reload();
    notify('All data was deleted.', 'info');
  }, [repos, reload, notify]);

  const loadDemoRoster = useDemoData(reload);

  return {
    loading: data.loading,
    storageKind,
    draft,
    errors,
    dirty,
    cap,
    powerPercent,
    setCount,
    setPowerPercent,
    setScoreEpsilon,
    save,
    discardChanges,
    restoreDefaults,
    counts: { members: members.length, events: events.length, suspensions: suspensions.length },
    exportBackup,
    exportRoster,
    chooseBackupFile,
    pendingRestore,
    confirmRestore,
    cancelRestore,
    resetAllData,
    loadDemoRoster,
  };
}

export type SettingsViewModel = ReturnType<typeof useSettingsViewModel>;
