import type { BuildingId } from '@/models/Building';
import { formatPower } from '@/helpers/format';

export interface BuildingPlayerData {
  memberId: string;
  name: string;
  power: number;
  overridden: boolean;
}

export interface BuildingBoardBuilding {
  id: BuildingId;
  label: string;
  capacity: number;
  players: BuildingPlayerData[];
}

export interface BuildingBoardData {
  buildings: BuildingBoardBuilding[];
  /** Starters without a place (more starters than places). */
  unplaced: BuildingPlayerData[];
}

interface BuildingBoardProps {
  board: BuildingBoardData;
  onSelectPlayer?: (memberId: string) => void;
  selectedId?: string | null;
}

function Chip({ player, onSelect, highlighted }: { player: BuildingPlayerData; onSelect?: () => void; highlighted: boolean }) {
  const body = (
    <>
      <span className="building-chip__name">{player.name}</span>
      <span className="building-chip__meta">{formatPower(player.power)}</span>
      {player.overridden && <span className="badge badge--warning">Manual</span>}
    </>
  );
  return onSelect ? (
    <button type="button" className={`building-chip${highlighted ? ' is-highlighted' : ''}`} onClick={onSelect}>
      {body}
    </button>
  ) : (
    <div className="building-chip">{body}</div>
  );
}

/** The starters placed on the Desert Storm buildings; tap a name to move or swap it. */
export function BuildingBoard({ board, onSelectPlayer, selectedId }: BuildingBoardProps) {
  return (
    <div className="building-board">
      {board.buildings.map((b) => (
        <section key={b.id} className={`building building--${b.id}`} aria-label={b.label}>
          <header className="building__header">
            <h3 className="building__title">{b.label}</h3>
            <span className="building__count">
              {b.players.length}/{b.capacity}
            </span>
          </header>
          <div className="building__list">
            {b.players.map((p) => (
              <Chip key={p.memberId} player={p} highlighted={selectedId === p.memberId} onSelect={onSelectPlayer ? () => onSelectPlayer(p.memberId) : undefined} />
            ))}
            {Array.from({ length: Math.max(0, b.capacity - b.players.length) }, (_, i) => (
              <div key={`empty-${i}`} className="building-chip building-chip--empty">
                free
              </div>
            ))}
          </div>
        </section>
      ))}
      {board.unplaced.length > 0 && (
        <section className="building building--unplaced" aria-label="Not placed">
          <header className="building__header">
            <h3 className="building__title">Not placed</h3>
            <span className="building__count">{board.unplaced.length}</span>
          </header>
          <div className="building__list">
            {board.unplaced.map((p) => (
              <Chip key={p.memberId} player={p} highlighted={selectedId === p.memberId} onSelect={onSelectPlayer ? () => onSelectPlayer(p.memberId) : undefined} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
