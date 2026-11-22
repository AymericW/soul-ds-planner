import { t } from '@/helpers/i18n';
import { useAppUpdateViewModel } from '@/viewmodels/useAppUpdateViewModel';

/** "App version" card: check for a new version, or reset the saved app files if it is stuck. */
export function AppUpdateSection() {
  const vm = useAppUpdateViewModel();
  const m = t().appUpdate;
  return (
    <div className="card settings-card">
      <h2 className="card__title">{m.title}</h2>
      <p className="muted small">
        {m.installed} <strong>{vm.buildLabel}</strong>. {m.installedHint}
      </p>
      <div className="action-list">
        <button type="button" className="button button--block" disabled={vm.busy !== null} onClick={() => void vm.check()}>
          {vm.busy === 'check' ? m.checking : m.check}
        </button>
        <button type="button" className="button button--block button--ghost" disabled={vm.busy !== null} onClick={vm.reset}>
          {vm.busy === 'reset' ? m.reloading : m.reset}
        </button>
      </div>
      <p className="muted small">{m.resetHint}</p>
    </div>
  );
}

/** Small link for the public join page: players may keep it open or installed for days. */
export function RefreshAppLink() {
  const vm = useAppUpdateViewModel();
  return (
    <div className="secondary-actions">
      <button type="button" className="button button--ghost button--small" disabled={vm.busy !== null} onClick={() => void vm.refresh()}>
        {vm.busy === 'refresh' ? t().appUpdate.refreshing : t().appUpdate.refresh}
      </button>
    </div>
  );
}
