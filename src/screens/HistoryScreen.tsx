import { EmptyState } from '@/components/EmptyState';
import { formatEventDate } from '@/helpers/dates';
import { pluralise } from '@/helpers/format';
import { useHistoryViewModel, type HistoryPlayer } from '@/viewmodels/useHistoryViewModel';

const GROUP_TITLES = { core: 'Core', rotation: 'Rotation', substitute: 'Substitutes' } as const;

function PlayerLine({ p, finalised }: { p: HistoryPlayer; finalised: boolean }) {
  const isStarter = p.slot !== 'substitute';
  let status = '';
  if (finalised) {
    if (p.attended) status = '✓ played';
    else if (!isStarter) status = 'not used';
    else status = p.notified ? '✗ absent (notified)' : '✗ no-show';
  }
  return (
    <li className={`history-player${p.suspended ? ' is-penalised' : ''}`}>
      <span>{p.name}</span>
      <span className={`history-player__status${p.attended ? ' is-ok' : ''}`}>{status}</span>
    </li>
  );
}

export function HistoryScreen() {
  const vm = useHistoryViewModel();
  return (
    <section className="screen">
      <div className="screen__head">
        <h1 className="screen__title">History</h1>
        <p className="muted small">Past Team A events, attendance and penalties.</p>
      </div>

      {vm.activeSuspensions.length > 0 && (
        <div className="card">
          <h2 className="card__title">Active suspensions</h2>
          <ul className="plain-list">
            {vm.activeSuspensions.map((s) => (
              <li key={s.id}>
                <strong>{s.name}</strong> – {pluralise(s.remaining, 'event')} left
              </li>
            ))}
          </ul>
          <p className="muted small">An R4 can lift a suspension early from the member's page in the Roster.</p>
        </div>
      )}

      {!vm.loading && vm.history.length === 0 && (
        <EmptyState title="No events yet">
          <p>Finalised weeks will appear here with who played, who was absent and any penalties.</p>
        </EmptyState>
      )}

      <div className="history-list">
        {vm.history.map((e) => {
          const open = vm.expandedId === e.id;
          const finalised = e.status === 'finalised';
          return (
            <article key={e.id} className="card history-event">
              <button type="button" className="history-event__head" aria-expanded={open} onClick={() => vm.toggleExpanded(e.id)}>
                <span>
                  <strong>{formatEventDate(e.date)}</strong>
                  <span className="muted small history-event__meta">
                    {finalised ? `${e.played} played · ${e.registered} registered` : `In progress (${e.status})`}
                    {e.penalties.length > 0 && ` · ${pluralise(e.penalties.length, 'penalty', 'penalties')}`}
                  </span>
                </span>
                <span aria-hidden="true">{open ? '▴' : '▾'}</span>
              </button>
              {open && (
                <div className="history-event__body">
                  {e.rules && <p className="muted small">Rules used: {e.rules}</p>}
                  {(Object.keys(GROUP_TITLES) as Array<keyof typeof GROUP_TITLES>).map((g) =>
                    e.groups[g].length ? (
                      <div key={g} className={`slot slot--${g}`}>
                        <h3 className="slot__title">
                          {GROUP_TITLES[g]} ({e.groups[g].length})
                        </h3>
                        <ul className="history-players">
                          {e.groups[g].map((p) => (
                            <PlayerLine key={p.memberId} p={p} finalised={finalised} />
                          ))}
                        </ul>
                      </div>
                    ) : null,
                  )}
                  {e.notSelected.length > 0 && (
                    <p className="muted small">Not selected: {e.notSelected.join(', ')}</p>
                  )}
                  <div className={`notice ${e.penalties.length ? 'notice--danger' : 'notice--success'}`}>
                    {e.penalties.length ? `Penalties issued: ${e.penalties.join(', ')}` : finalised ? 'No penalties issued.' : 'Not finalised yet.'}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
