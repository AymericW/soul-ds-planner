import { useState } from 'react';
import type { BuildingId } from '@/models/Building';
import { Modal } from './Modal';

interface BuildingActionSheetProps {
  player: { memberId: string; name: string; building: BuildingId | null };
  buildings: ReadonlyArray<{ id: BuildingId; label: string; free: number }>;
  others: ReadonlyArray<{ memberId: string; name: string; buildingLabel: string }>;
  onMove: (to: BuildingId) => void;
  onSwap: (otherId: string) => void;
  onClose: () => void;
}

/** Manual building override: move a starter to a building with a free place, or swap with another starter. */
export function BuildingActionSheet({ player, buildings, others, onMove, onSwap, onClose }: BuildingActionSheetProps) {
  const [swapping, setSwapping] = useState(false);
  const targets = buildings.filter((b) => b.id !== player.building);
  return (
    <Modal title={player.name} onClose={onClose}>
      {!swapping ? (
        <div className="action-list">
          {targets.map((b) => (
            <button key={b.id} type="button" className="button button--block" disabled={b.free === 0} onClick={() => onMove(b.id)}>
              {b.label}
              <span className="muted small"> · {b.free === 0 ? 'full' : `${b.free} free`}</span>
            </button>
          ))}
          <button type="button" className="button button--block button--ghost" onClick={() => setSwapping(true)}>
            Swap with another player…
          </button>
        </div>
      ) : (
        <ul className="pick-list">
          {others
            .filter((o) => o.memberId !== player.memberId)
            .map((o) => (
              <li key={o.memberId}>
                <button type="button" className="pick-list__item" onClick={() => onSwap(o.memberId)}>
                  <span>{o.name}</span>
                  <span className="muted small">{o.buildingLabel}</span>
                </button>
              </li>
            ))}
        </ul>
      )}
    </Modal>
  );
}
