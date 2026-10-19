import { useState } from 'react';
import { Modal } from './Modal';
import { WarningIcon } from './Icons';

interface EarlyRunSheetProps {
  /** "Team A", or "Team A and Team B". */
  teams: string;
  /** Countdown, e.g. "1 d 6 h". */
  closesIn: string;
  /** e.g. "Wed 14 Oct 2026, 10 PM (Paris time)". */
  closeLabel: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

const CONFIRM_WORD = 'EARLY';

/** Hard warning before running the selection while players can still register (before Wednesday 10 PM). */
export function EarlyRunSheet({ teams, closesIn, closeLabel, confirmLabel, onConfirm, onCancel }: EarlyRunSheetProps) {
  const [typed, setTyped] = useState('');
  const [working, setWorking] = useState(false);
  const enabled = !working && typed.trim().toUpperCase() === CONFIRM_WORD;

  const confirm = async () => {
    setWorking(true);
    try {
      await onConfirm();
    } finally {
      setWorking(false);
    }
  };

  return (
    <Modal title="Registrations are still open" onClose={onCancel}>
      <div className="early">
        <div className="early__icon" aria-hidden="true">
          <WarningIcon size={22} />
        </div>
        <div className="early__countdown">
          <span className="early__eyebrow">Closes in</span>
          <strong className="early__time">{closesIn}</strong>
          <span className="small">{closeLabel}</span>
        </div>
        <p className="sheet-text">Running the selection for {teams} now closes the join link. Everyone who registers later is left out.</p>
        <label className="field">
          <span className="field__label">
            Type <strong>{CONFIRM_WORD}</strong> to run it anyway
          </span>
          <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </label>
        <div className="early__actions">
          <button type="button" className="button button--primary button--block" onClick={onCancel}>
            Wait until Wednesday
          </button>
          <button type="button" className="button button--danger-ghost button--block" disabled={!enabled} onClick={() => void confirm()}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
