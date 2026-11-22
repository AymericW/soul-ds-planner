import { t } from '@/helpers/i18n';
import { useState } from 'react';
import { AccountSection } from '@/screens/AccountSection';
import { AppUpdateSection } from '@/screens/AppUpdateSection';
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
  const [confirmCode, setConfirmCode] = useState(false);
  const d = vm.draft;
  const hasErrors = Object.keys(vm.errors).length > 0;
  const m = t().settings;
  const slots = t().slots;

  return (
    <section className="screen">
      <div className="screen__head">
        <h1 className="screen__title">{m.title}</h1>
        <p className="muted small">{m.subtitle}</p>
      </div>

      <div className="card settings-card">
        <h2 className="card__title">{m.places}</h2>
        <NumberStepper label={slots.coreStarters} value={d.coreStarters} {...SETTINGS_LIMITS.coreStarters} error={vm.errors.coreStarters} onChange={(v) => vm.setCount('coreStarters', v)} hint={m.coreHint} />
        <NumberStepper label={slots.rotationStarters} value={d.rotationStarters} {...SETTINGS_LIMITS.rotationStarters} error={vm.errors.rotationStarters} onChange={(v) => vm.setCount('rotationStarters', v)} hint={m.rotationHint} />
        <NumberStepper label={slots.substitute} value={d.substitutes} {...SETTINGS_LIMITS.substitutes} error={vm.errors.substitutes} onChange={(v) => vm.setCount('substitutes', v)} />
        <div className="notice notice--info">
          {m.placesNoticeBefore} <strong>{Number.isFinite(vm.cap) ? vm.cap : '–'}</strong> {m.placesNoticeAfter}
        </div>
      </div>

      <div className="card settings-card">
        <h2 className="card__title">{m.penalties}</h2>
        <NumberStepper
          label={m.suspensionLength}
          value={d.suspensionEvents}
          {...SETTINGS_LIMITS.suspensionEvents}
          error={vm.errors.suspensionEvents}
          onChange={(v) => vm.setCount('suspensionEvents', v)}
          hint={m.suspensionHint}
        />
      </div>

      <div className="card settings-card">
        <h2 className="card__title">{m.weights}</h2>
        <label className="field">
          <span className="field__label">{m.weightsLabel(vm.powerPercent, 100 - vm.powerPercent)}</span>
          <input
            className="range"
            type="range"
            min={0}
            max={100}
            step={5}
            value={vm.powerPercent}
            onChange={(e) => vm.setPowerPercent(Number(e.target.value))}
            aria-label={m.weightAria}
          />
          <span className="field__hint">{m.weightsHint}</span>
          {vm.errors.weights && <span className="field__error">{vm.errors.weights}</span>}
        </label>
        <NumberStepper
          label={m.tieMargin}
          value={Math.round(d.scoreEpsilon * 100)}
          min={SETTINGS_LIMITS.scoreEpsilon.min * 100}
          max={SETTINGS_LIMITS.scoreEpsilon.max * 100}
          error={vm.errors.scoreEpsilon}
          onChange={(v) => vm.setScoreEpsilon(v / 100)}
          hint={m.tieHint}
        />
      </div>

      <div className="card settings-card">
        <h2 className="card__title">{m.joinLink}</h2>
        <p className="muted small">{m.joinHint}</p>
        {vm.joinLink ? (
          <>
            <div className="field">
              <span className="field__label">{m.joinCode}</span>
              <code className="join-code">{vm.joinCode}</code>
            </div>
            <div className="action-list">
              <button type="button" className="button button--block button--primary" onClick={() => void vm.copyJoinLink()}>
                {m.copyJoinLink}
              </button>
              <button type="button" className="button button--block" disabled={vm.dirty} onClick={() => setConfirmCode(true)}>
                {m.newCode}
              </button>
              <button type="button" className="button button--block button--ghost" disabled={vm.dirty} onClick={() => void vm.disableJoinPage()}>
                {m.disableJoin}
              </button>
            </div>
          </>
        ) : (
          <div className="action-list">
            <p className="small">{m.joinDisabled}</p>
            <button type="button" className="button button--block button--primary" disabled={vm.dirty} onClick={() => void vm.regenerateJoinCode()}>
              {m.createCode}
            </button>
          </div>
        )}
        {vm.dirty && <p className="muted small">{m.saveFirst}</p>}
        <label className="field">
          <span className="field__label">{m.powerDrop(d.powerDropTolerancePct)}</span>
          <input
            className="range"
            type="range"
            min={SETTINGS_LIMITS.powerDropTolerancePct.min}
            max={SETTINGS_LIMITS.powerDropTolerancePct.max}
            step={1}
            value={d.powerDropTolerancePct}
            onChange={(e) => vm.setTolerance('powerDropTolerancePct', Number(e.target.value))}
            aria-label={m.powerDropAria}
          />
          {vm.errors.powerDropTolerancePct && <span className="field__error">{vm.errors.powerDropTolerancePct}</span>}
        </label>
        <label className="field">
          <span className="field__label">{m.powerRise(d.powerRiseTolerancePct)}</span>
          <input
            className="range"
            type="range"
            min={SETTINGS_LIMITS.powerRiseTolerancePct.min}
            max={SETTINGS_LIMITS.powerRiseTolerancePct.max}
            step={5}
            value={d.powerRiseTolerancePct}
            onChange={(e) => vm.setTolerance('powerRiseTolerancePct', Number(e.target.value))}
            aria-label={m.powerRiseAria}
          />
          <span className="field__hint">{m.toleranceHint}</span>
          {vm.errors.powerRiseTolerancePct && <span className="field__error">{vm.errors.powerRiseTolerancePct}</span>}
        </label>
      </div>

      <div className="sticky-actions sticky-actions--row">
        <button type="button" className="button" onClick={vm.restoreDefaults}>
          {m.defaults}
        </button>
        <button type="button" className="button" disabled={!vm.dirty} onClick={vm.discardChanges}>
          {m.undo}
        </button>
        <button type="button" className="button button--primary" disabled={!vm.dirty || hasErrors} onClick={() => void vm.save()}>
          {t().common.save}
        </button>
      </div>

      <div className="card settings-card">
        <h2 className="card__title">{m.backup}</h2>
        <p className="muted small">{m.backupHint(vm.counts.members, vm.counts.events)}</p>
        <div className="action-list">
          <button type="button" className="button button--block" onClick={vm.exportBackup}>
            {m.exportBackup}
          </button>
          {isAdmin && (
            <FileButton accept="application/json,.json" onFile={(f) => void vm.chooseBackupFile(f)} className="button button--block">
              {m.restoreBackup}
            </FileButton>
          )}
          <button type="button" className="button button--block" onClick={vm.exportRoster} disabled={vm.counts.members === 0}>
            {m.exportRoster}
          </button>
          {isAdmin && import.meta.env.DEV && (
            <button type="button" className="button button--block button--ghost" onClick={() => void vm.loadDemoRoster()}>
              {t().roster.loadDemo}
            </button>
          )}
          {isAdmin && (
            <button type="button" className="button button--block button--danger-ghost" onClick={() => setConfirmReset(true)}>
              {m.resetAll}
            </button>
          )}
        </div>
      </div>

      <AccountSection />

      <AppUpdateSection />

      {vm.pendingRestore && (
        <ConfirmDialog
          title={m.restoreTitle}
          message={
            <p>
              <strong>{vm.pendingRestore.fileName}</strong>
              {m.restoreText(
                formatTimestamp(vm.pendingRestore.backup.exportedAt),
                vm.pendingRestore.backup.members.length,
                vm.pendingRestore.backup.events.length,
              )}
            </p>
          }
          confirmLabel={m.replaceData}
          danger
          onCancel={vm.cancelRestore}
          onConfirm={vm.confirmRestore}
        />
      )}
      {confirmCode && (
        <ConfirmDialog
          title={m.newCodeTitle}
          message={<p>{m.newCodeText}</p>}
          confirmLabel={m.newCodeConfirm}
          onCancel={() => setConfirmCode(false)}
          onConfirm={async () => {
            await vm.regenerateJoinCode();
            setConfirmCode(false);
          }}
        />
      )}
      {confirmReset && (
        <ConfirmDialog
          title={m.resetTitle}
          message={<p>{m.resetText}</p>}
          confirmLabel={m.resetConfirm}
          danger
          requireText={m.resetWord}
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
