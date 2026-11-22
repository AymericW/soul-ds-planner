import { t } from '@/helpers/i18n';
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

const sections = (): ReadonlyArray<{ slot: Slot; title: string; hint: string }> => [
  { slot: 'core', title: t().slots.coreStarters, hint: t().week.coreHint },
  { slot: 'rotation', title: t().slots.rotationStarters, hint: t().week.rotationHint },
  { slot: 'substitute', title: t().slots.substitute, hint: t().week.substituteHint },
  { slot: 'notSelected', title: t().slots.notSelected, hint: t().week.notSelectedHint },
];

export function SlotBoard({ board, capacity, onSelectPlayer, selectedId }: SlotBoardProps) {
  return (
    <div className="slot-board">
      {sections().map(({ slot, title, hint }) => {
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
              <p className="muted small">{t().common.nobody}</p>
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
