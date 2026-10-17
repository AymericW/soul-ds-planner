import type { Slot } from '@/models/Assignment';
import { PlayerCard, type PlayerCardData } from './PlayerCard';

export interface SlotBoardData {
  core: PlayerCardData[];
  rotation: PlayerCardData[];
  substitute: PlayerCardData[];
  notSelected: PlayerCardData[];
}

interface SlotBoardProps {
  board: SlotBoardData;
  capacity: Record<Exclude<Slot, 'notSelected'>, number>;
  onSelectPlayer?: (memberId: string) => void;
  selectedId?: string | null;
}

const SECTIONS: ReadonlyArray<{ slot: Slot; title: string; hint: string }> = [
  { slot: 'core', title: 'Core starters', hint: 'Best relative score (power + activity)' },
  { slot: 'rotation', title: 'Rotation starters', hint: 'Fair turn for players who waited longest' },
  { slot: 'substitute', title: 'Substitutes', hint: 'Called in this order if a starter is missing' },
  { slot: 'notSelected', title: 'Not selected', hint: 'No place left, inactive or suspended' },
];

export function SlotBoard({ board, capacity, onSelectPlayer, selectedId }: SlotBoardProps) {
  return (
    <div className="slot-board">
      {SECTIONS.map(({ slot, title, hint }) => {
        const players = board[slot];
        if (slot === 'notSelected' && players.length === 0) return null;
        const cap = slot === 'notSelected' ? null : capacity[slot];
        return (
          <section key={slot} className={`slot slot--${slot}`} aria-label={title}>
            <header className="slot__header" title={hint}>
              <h3 className="slot__title">{title}</h3>
              <span className="slot__count">{cap === null ? players.length : `${players.length}/${cap}`}</span>
            </header>
            {players.length === 0 ? (
              <p className="muted small">Nobody.</p>
            ) : (
              <div className="slot__list">
                {players.map((p) => (
                  <PlayerCard
                    key={p.memberId}
                    player={p}
                    showOrder={slot === 'substitute'}
                    highlighted={selectedId === p.memberId}
                    onSelect={onSelectPlayer ? () => onSelectPlayer(p.memberId) : undefined}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
