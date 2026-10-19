import { useState } from 'react';
import { formatPower } from '@/helpers/format';
import { Modal } from './Modal';

interface RegistrationSheetProps {
  name: string;
  power: number;
  team: string;
  registered: boolean;
  substituteOnly: boolean;
  /** Second line under the name, e.g. "Self-registered · Sent Mon 09:02". */
  detail?: string;
  /** Warning shown above the actions, e.g. "Suspended (1)": they can be ticked but will not be selected. */
  warning?: string;
  onToggle: () => void | Promise<void>;
  onToggleSubstitute: () => void | Promise<void>;
  onEditPower: () => void;
  onClose: () => void;
}

/** Bottom sheet opened by tapping a member in the poll list: confirm tick/untick, plus the member's options. */
export function RegistrationSheet({
  name,
  power,
  team,
  registered,
  substituteOnly,
  detail,
  warning,
  onToggle,
  onToggleSubstitute,
  onEditPower,
  onClose,
}: RegistrationSheetProps) {
  const [working, setWorking] = useState(false);
  const run = async (action: () => void | Promise<void>) => {
    setWorking(true);
    try {
      await action();
    } finally {
      setWorking(false);
    }
  };

  return (
    <Modal
      title={registered ? `Untick ${name}?` : `Tick ${name}?`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button button--ghost" onClick={onClose}>
            Keep
          </button>
          <button
            type="button"
            className={`button ${registered ? 'button--danger' : 'button--primary'}`}
            disabled={working}
            onClick={() => void run(onToggle)}
          >
            {registered ? 'Untick' : 'Tick'}
          </button>
        </>
      }
    >
      <div className="sheet-member">
        <span className="sheet-member__avatar" aria-hidden="true">
          {name.slice(0, 1).toUpperCase()}
        </span>
        <span className="sheet-member__meta">
          <strong>{formatPower(power)}</strong>
          {detail && <span className="muted small">{detail}</span>}
        </span>
      </div>
      <p className="sheet-text">{registered ? `${name} will be removed from the ${team} registrations.` : `${name} will be registered for ${team}.`}</p>
      {warning && <div className="notice notice--warning small">{warning}: can be ticked but will not be selected.</div>}
      {registered && (
        <div className="sheet-options">
          <label className="switch">
            <input type="checkbox" checked={substituteOnly} disabled={working} onChange={() => void run(onToggleSubstitute)} />
            <span>
              Sub only <span className="muted small">– voted to be a substitute, never picked as starter</span>
            </span>
          </label>
          <button type="button" className="button button--ghost button--small" onClick={onEditPower}>
            Edit power
          </button>
        </div>
      )}
    </Modal>
  );
}
