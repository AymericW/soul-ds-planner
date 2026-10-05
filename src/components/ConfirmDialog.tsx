import { useState, type ReactNode } from 'react';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  /** When set, the user must type this word to enable the confirm button. */
  requireText?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

/** In-app replacement for window.confirm(). */
export function ConfirmDialog({ title, message, confirmLabel, danger, requireText, onConfirm, onCancel }: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  const [working, setWorking] = useState(false);
  const enabled = !working && (!requireText || typed.trim().toUpperCase() === requireText.toUpperCase());

  const confirm = async () => {
    setWorking(true);
    try {
      await onConfirm();
    } finally {
      setWorking(false);
    }
  };

  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="button button--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={`button ${danger ? 'button--danger' : 'button--primary'}`}
            disabled={!enabled}
            onClick={() => void confirm()}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="confirm__message">{message}</div>
      {requireText && (
        <label className="field">
          <span className="field__label">
            Type <strong>{requireText}</strong> to confirm
          </span>
          <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </label>
      )}
    </Modal>
  );
}
