import { formatPower } from '@/helpers/format';

export interface PlayerCardData {
  memberId: string;
  name: string;
  power: number;
  activity: number;
  rank?: string;
  order: number;
  reason: string;
  overridden: boolean;
}

interface PlayerCardProps {
  player: PlayerCardData;
  showOrder?: boolean;
  onSelect?: () => void;
  highlighted?: boolean;
}

/** One player in the plan with the short "why". */
export function PlayerCard({ player, showOrder, onSelect, highlighted }: PlayerCardProps) {
  const body = (
    <>
      <div className="player-card__top">
        {showOrder && <span className="player-card__order">{player.order + 1}</span>}
        <span className="player-card__name">{player.name}</span>
        {player.rank && <span className="badge badge--rank">{player.rank}</span>}
        {player.overridden && <span className="badge badge--warning">Manual</span>}
        <span className="player-card__meta">
          {formatPower(player.power)} · ★{player.activity}
        </span>
      </div>
      <div className="player-card__why">{player.reason}</div>
    </>
  );
  return onSelect ? (
    <button type="button" className={`player-card${highlighted ? ' is-highlighted' : ''}`} onClick={onSelect}>
      {body}
    </button>
  ) : (
    <div className="player-card">{body}</div>
  );
}
