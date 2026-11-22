import { t } from '@/helpers/i18n';
import { useState } from 'react';
import type { Slot } from '@/models/Assignment';
import { Modal } from './Modal';

interface PlayerActionSheetProps {
  player: { memberId: string; name: string; slot: Slot; reason: string };
  others: ReadonlyArray<{ memberId: string; name: string; slot: Slot }>;
  onMove: (to: Slot) => void;
  onSwap: (otherId: string) => void;
  onClose: () => void;
}

const SLOTS: readonly Slot[] = ['core', 'rotation', 'substitute', 'notSelected'];

/** Manual override menu: move a player to another group or swap with someone. */
export function PlayerActionSheet({ player, others, onMove, onSwap, onClose }: PlayerActionSheetProps) {
  const [swapping, setSwapping] = useState(false);
  const m = t();
  return (
    <Modal title={player.name} onClose={onClose}>
      <p className="muted small">{player.reason}</p>
      {!swapping ? (
        <div className="action-list">
          {SLOTS
            .filter((s) => s !== player.slot)
            .map((s) => (
              <button key={s} type="button" className="button button--block" onClick={() => onMove(s)}>
                {m.slots.moveTo(m.slots[s])}
              </button>
            ))}
          <button type="button" className="button button--block button--ghost" onClick={() => setSwapping(true)}>
            {m.week.swap}
          </button>
        </div>
      ) : (
        <ul className="pick-list">
          {others
            .filter((o) => o.memberId !== player.memberId && o.slot !== player.slot)
            .map((o) => (
              <li key={o.memberId}>
                <button type="button" className="pick-list__item" onClick={() => onSwap(o.memberId)}>
                  <span>{o.name}</span>
                  <span className="muted small">{m.slots[o.slot]}</span>
                </button>
              </li>
            ))}
        </ul>
      )}
    </Modal>
  );
}
