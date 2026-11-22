import { t } from '@/helpers/i18n';
import { useState } from 'react';
import { appBuildLabel, checkForUpdates, resetAppFiles } from '@/services/appUpdate';
import { useToasts } from '@/viewmodels/ToastContext';

/** Manual "check for updates" / "reset app files" for the installed app (see services/appUpdate). */
export function useAppUpdateViewModel() {
  const { notify } = useToasts();
  const [busy, setBusy] = useState<'check' | 'reset' | 'refresh' | null>(null);

  async function check() {
    setBusy('check');
    try {
      const result = await checkForUpdates();
      if (result === 'updating') {
        notify(t().appUpdate.found, 'success');
        return; // the page reloads; keep the buttons disabled
      }
      if (result === 'latest') notify(t().appUpdate.latest, 'success');
      else notify(t().appUpdate.unsupported, 'warning');
    } catch {
      notify(t().appUpdate.offline, 'error');
    }
    setBusy(null);
  }

  function reset() {
    setBusy('reset');
    void resetAppFiles();
  }

  /** One tap for players: take a new version if there is one, otherwise just reload. */
  async function refresh() {
    setBusy('refresh');
    const result = await checkForUpdates().catch(() => 'latest' as const);
    if (result !== 'updating') window.location.reload();
  }

  return { buildLabel: appBuildLabel(), busy, check, reset, refresh };
}
