import { t } from '@/helpers/i18n';
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

  const m = t().week;
  return (
    <Modal
      title={registered ? m.untickName(name) : m.tickName(name)}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button button--ghost" onClick={onClose}>
            {m.keep}
          </button>
          <button
            type="button"
            className={`button ${registered ? 'button--danger' : 'button--primary'}`}
            disabled={working}
            onClick={() => void run(onToggle)}
          >
            {registered ? m.untick : m.tick}
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
      <p className="sheet-text">{registered ? m.willBeRemoved(name, team) : m.willBeRegistered(name, team)}</p>
      {warning && <div className="notice notice--warning small">{m.canBeTicked(warning)}</div>}
      {registered && (
        <div className="sheet-options">
          <label className="switch">
            <input type="checkbox" checked={substituteOnly} disabled={working} onChange={() => void run(onToggleSubstitute)} />
            <span>
              {m.subOnly} <span className="muted small">{m.subOnlyHint}</span>
            </span>
          </label>
          <button type="button" className="button button--ghost button--small" onClick={onEditPower}>
            {m.editPower}
          </button>
        </div>
      )}
    </Modal>
  );
}
