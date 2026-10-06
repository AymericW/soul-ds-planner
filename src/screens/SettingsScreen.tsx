import { useState } from 'react';
import { AccountSection } from '@/screens/AccountSection';
import { useAuth } from '@/viewmodels/AuthContext';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FileButton } from '@/components/FileButton';
import { NumberStepper } from '@/components/NumberStepper';
import { SETTINGS_LIMITS } from '@/constants/rules';
import { formatTimestamp } from '@/helpers/dates';
import { useSettingsViewModel } from '@/viewmodels/useSettingsViewModel';

export function SettingsScreen() {
  const vm = useSettingsViewModel();
  const { isAdmin } = useAuth();
  const [confirmReset, setConfirmReset] = useState(false);
  const d = vm.draft;
  const hasErrors = Object.keys(vm.errors).length > 0;

  return (
    <section className="screen">
      <div className="screen__head">
        <h1 className="screen__title">Settings</h1>
        <p className="muted small">Rules used by the weekly selection. Changes apply from the next “Run selection”.</p>
      </div>

      <div className="card settings-card">
        <h2 className="card__title">Team A slots</h2>
        <NumberStepper label="Core starters" value={d.coreStarters} {...SETTINGS_LIMITS.coreStarters} error={vm.errors.coreStarters} onChange={(v) => vm.setCount('coreStarters', v)} hint="Picked by relative score (power + activity)." />
        <NumberStepper label="Rotation starters" value={d.rotationStarters} {...SETTINGS_LIMITS.rotationStarters} error={vm.errors.rotationStarters} onChange={(v) => vm.setCount('rotationStarters', v)} hint="Fair turn for those who waited longest." />
        <NumberStepper label="Substitutes" value={d.substitutes} {...SETTINGS_LIMITS.substitutes} error={vm.errors.substitutes} onChange={(v) => vm.setCount('substitutes', v)} />
        <div className="notice notice--info">
          Maximum registrations: <strong>{Number.isFinite(vm.cap) ? vm.cap : '–'}</strong> (starters + substitutes). Below this cap everybody who applies gets a place.
        </div>
      </div>

      <div className="card settings-card">
        <h2 className="card__title">Penalties</h2>
        <NumberStepper
          label="Suspension length (Team A events)"
          value={d.suspensionEvents}
          {...SETTINGS_LIMITS.suspensionEvents}
          error={vm.errors.suspensionEvents}
          onChange={(v) => vm.setCount('suspensionEvents', v)}
          hint="A starter who does not show up and did not notify is excluded for this many events. 0 = no suspensions."
        />
      </div>

      <div className="card settings-card">
        <h2 className="card__title">Core score weights</h2>
        <label className="field">
          <span className="field__label">
            Power {vm.powerPercent}% · Activity {100 - vm.powerPercent}%
          </span>
          <input
            className="range"
            type="range"
            min={0}
            max={100}
            step={5}
            value={vm.powerPercent}
            onChange={(e) => vm.setPowerPercent(Number(e.target.value))}
            aria-label="Power weight percent"
          />
          <span className="field__hint">Power is measured relative to the strongest applicant of the week; activity is the R4 rating 1–5.</span>
          {vm.errors.weights && <span className="field__error">{vm.errors.weights}</span>}
        </label>
        <NumberStepper
          label="Tie margin (score points × 100)"
          value={Math.round(d.scoreEpsilon * 100)}
          min={SETTINGS_LIMITS.scoreEpsilon.min * 100}
          max={SETTINGS_LIMITS.scoreEpsilon.max * 100}
          error={vm.errors.scoreEpsilon}
          onChange={(v) => vm.setScoreEpsilon(v / 100)}
          hint="When two core scores are this close, the more active player ranks higher. Default 2 (= 0.02)."
        />
      </div>

      <div className="sticky-actions sticky-actions--row">
        <button type="button" className="button" onClick={vm.restoreDefaults}>
          Defaults
        </button>
        <button type="button" className="button" disabled={!vm.dirty} onClick={vm.discardChanges}>
          Undo
        </button>
        <button type="button" className="button button--primary" disabled={!vm.dirty || hasErrors} onClick={() => void vm.save()}>
          Save
        </button>
      </div>

      <div className="card settings-card">
        <h2 className="card__title">Backup &amp; data</h2>
        <p className="muted small">
          Data is shared by all R4s and stored online ({vm.counts.members} members, {vm.counts.events} events). Export a backup
          regularly as a safety copy.
        </p>
        <div className="action-list">
          <button type="button" className="button button--block" onClick={vm.exportBackup}>
            Export backup (JSON)
          </button>
          {isAdmin && (
            <FileButton accept="application/json,.json" onFile={(f) => void vm.chooseBackupFile(f)} className="button button--block">
              Restore backup…
            </FileButton>
          )}
          <button type="button" className="button button--block" onClick={vm.exportRoster} disabled={vm.counts.members === 0}>
            Export roster (CSV)
          </button>
          {isAdmin && (
            <button type="button" className="button button--block button--ghost" onClick={() => void vm.loadDemoRoster()}>
              Load demo roster
            </button>
          )}
          {isAdmin && (
            <button type="button" className="button button--block button--danger-ghost" onClick={() => setConfirmReset(true)}>
              Reset all data…
            </button>
          )}
        </div>
      </div>

      <AccountSection />

      {vm.pendingRestore && (
        <ConfirmDialog
          title="Restore this backup?"
          message={
            <p>
              <strong>{vm.pendingRestore.fileName}</strong> from {formatTimestamp(vm.pendingRestore.backup.exportedAt)} contains{' '}
              {vm.pendingRestore.backup.members.length} members and {vm.pendingRestore.backup.events.length} events. Everything currently stored
              online for the whole alliance will be replaced.
            </p>
          }
          confirmLabel="Replace my data"
          danger
          onCancel={vm.cancelRestore}
          onConfirm={vm.confirmRestore}
        />
      )}
      {confirmReset && (
        <ConfirmDialog
          title="Delete all data?"
          message={<p>Roster, history, suspensions and settings will be deleted for the whole alliance. Export a backup first if unsure.</p>}
          confirmLabel="Delete everything"
          danger
          requireText="RESET"
          onCancel={() => setConfirmReset(false)}
          onConfirm={async () => {
            await vm.resetAllData();
            setConfirmReset(false);
          }}
        />
      )}
    </section>
  );
}
