import type { PlayerCardData } from './PlayerCard';
import type { SlotBoardData } from './SlotBoard';

const GROUPS: ReadonlyArray<{ slot: 'core' | 'rotation' | 'substitute'; title: string }> = [
  { slot: 'core', title: 'Core starters' },
  { slot: 'rotation', title: 'Rotation starters' },
  { slot: 'substitute', title: 'Substitutes' },
];

interface SignupListProps {
  board: SlotBoardData;
  capacity: Record<'core' | 'rotation' | 'substitute', number>;
}

/** Compact numbered list of the whole lineup (subs included) to sign everyone up in the game at a glance. */
export function SignupList({ board, capacity }: SignupListProps) {
  let number = 0;
  const groups = GROUPS.map((g) => ({
    ...g,
    players: board[g.slot].map((p: PlayerCardData) => ({ ...p, n: ++number })),
  }));
  return (
    <div className="signup">
      {groups.map((g) => (
        <section key={g.slot} className={`signup__group slot--${g.slot}`} aria-label={g.title}>
          <h3 className="signup__title">
            <span className="dot" aria-hidden="true" />
            {g.title}
            <span className="signup__count">
              {g.players.length}/{capacity[g.slot]}
            </span>
          </h3>
          {g.players.length === 0 ? (
            <p className="muted small">Nobody.</p>
          ) : (
            <ol className="signup__list" style={{ gridTemplateRows: `repeat(${Math.ceil(g.players.length / 2)}, auto)` }}>
              {g.players.map((p) => (
                <li key={p.memberId} className="signup__item">
                  <span className="signup__n">{p.n}</span>
                  <span className="signup__name">{p.name}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      ))}
    </div>
  );
}
