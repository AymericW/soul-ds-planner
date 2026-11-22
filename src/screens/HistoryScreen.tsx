import { t } from '@/helpers/i18n';
import { EmptyState } from '@/components/EmptyState';
import { formatEventDate } from '@/helpers/dates';
import { useHistoryViewModel, type HistoryPlayer } from '@/viewmodels/useHistoryViewModel';

const GROUPS = ['core', 'rotation', 'substitute'] as const;

function PlayerLine({ p, finalised }: { p: HistoryPlayer; finalised: boolean }) {
  const isStarter = p.slot !== 'substitute';
  const m = t().history;
  let status = '';
  if (finalised) {
    if (p.attended) status = m.played;
    else if (!isStarter) status = m.notUsed;
    else status = p.notified ? m.absentNotified : m.noShow;
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
  const m = t().history;
  return (
    <section className="screen">
      <div className="screen__head">
        <h1 className="screen__title">{m.title}</h1>
        <p className="muted small">{m.subtitle}</p>
      </div>

      {vm.activeSuspensions.length > 0 && (
        <div className="card">
          <h2 className="card__title">{m.activeSuspensions}</h2>
          <ul className="plain-list">
            {vm.activeSuspensions.map((s) => (
              <li key={s.id}>
                <strong>{s.name}</strong> – {m.left(t().count.event(s.remaining))}
              </li>
            ))}
          </ul>
          <p className="muted small">{m.liftHint}</p>
        </div>
      )}

      {!vm.loading && vm.history.length === 0 && (
        <EmptyState title={m.empty}>
          <p>{m.emptyHint}</p>
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
                  <strong>
                    {formatEventDate(e.date)} · {e.team}
                  </strong>
                  <span className="muted small history-event__meta">
                    {finalised ? m.meta(e.played, e.registered) : m.inProgress(t().status[e.status])}
                    {e.penalties.length > 0 && ` · ${t().count.penalty(e.penalties.length)}`}
                  </span>
                </span>
                <span aria-hidden="true">{open ? '▴' : '▾'}</span>
              </button>
              {open && (
                <div className="history-event__body">
                  {e.rules && <p className="muted small">{m.rulesUsed(e.rules)}</p>}
                  {GROUPS.map((g) =>
                    e.groups[g].length ? (
                      <div key={g} className={`slot slot--${g}`}>
                        <h3 className="slot__title">
                          {t().slots[g]} ({e.groups[g].length})
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
                    <p className="muted small">{m.notSelected(e.notSelected.join(', '))}</p>
                  )}
                  <div className={`notice ${e.penalties.length ? 'notice--danger' : 'notice--success'}`}>
                    {e.penalties.length ? m.penaltiesIssued(e.penalties.join(', ')) : finalised ? m.noPenalties : m.notFinalised}
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
