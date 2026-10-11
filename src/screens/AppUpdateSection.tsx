import { useAppUpdateViewModel } from '@/viewmodels/useAppUpdateViewModel';

/** "App version" card: check for a new version, or reset the saved app files if it is stuck. */
export function AppUpdateSection() {
  const vm = useAppUpdateViewModel();
  return (
    <div className="card settings-card">
      <h2 className="card__title">App version</h2>
      <p className="muted small">
        Installed version: <strong>{vm.buildLabel}</strong>. The app updates itself when it opens; use this if something looks outdated. No need to
        reinstall.
      </p>
      <div className="action-list">
        <button type="button" className="button button--block" disabled={vm.busy !== null} onClick={() => void vm.check()}>
          {vm.busy === 'check' ? 'Checking…' : 'Check for updates'}
        </button>
        <button type="button" className="button button--block button--ghost" disabled={vm.busy !== null} onClick={vm.reset}>
          {vm.busy === 'reset' ? 'Reloading…' : 'Still outdated? Reset app files'}
        </button>
      </div>
      <p className="muted small">Resetting reloads the app from the server. You stay logged in and nothing is deleted.</p>
    </div>
  );
}

/** Small link for the public join page: players may keep it open or installed for days. */
export function RefreshAppLink() {
  const vm = useAppUpdateViewModel();
  return (
    <div className="secondary-actions">
      <button type="button" className="button button--ghost button--small" disabled={vm.busy !== null} onClick={() => void vm.refresh()}>
        {vm.busy === 'refresh' ? 'Refreshing…' : 'Page looks outdated? Refresh'}
      </button>
    </div>
  );
}
