import { t } from '@/helpers/i18n';
import { useState } from 'react';
import { EmptyState } from '@/components/EmptyState';
import { formatTimestamp } from '@/helpers/dates';
import { formatPercent, formatPower } from '@/helpers/format';
import { useRequestsViewModel, type JoinRequestView, type RequestsViewModel } from '@/viewmodels/useRequestsViewModel';

export function RequestsScreen() {
  const vm = useRequestsViewModel();
  const empty = !vm.loading && vm.requests.length === 0 && vm.powerReviews.length === 0;
  const m = t().requests;

  return (
    <section className="screen">
      <div className="screen__head">
        <h1 className="screen__title">{m.title}</h1>
        <p className="muted small">{m.subtitle}</p>
      </div>

      {empty && (
        <EmptyState title={m.empty}>
          <p>{m.emptyHint}</p>
        </EmptyState>
      )}

      {vm.requests.length > 0 && (
        <div className="card">
          <h2 className="card__title">{m.notInRoster(vm.requests.length)}</h2>
          <ul className="plain-list request-list">
            {vm.requests.map((r) => (
              <JoinRequestItem key={r.request.id} item={r} vm={vm} />
            ))}
          </ul>
        </div>
      )}

      {vm.powerReviews.length > 0 && (
        <div className="card">
          <h2 className="card__title">{m.powerChanges(vm.powerReviews.length)}</h2>
          <ul className="plain-list request-list">
            {vm.powerReviews.map((p) => (
              <li key={p.change.id} className="request">
                <div className="request__head">
                  <strong>{p.memberName}</strong>
                  <span className="muted small">{formatTimestamp(p.change.createdAt)}</span>
                </div>
                <p className="small">
                  {m.rosterToEntered(formatPower(p.rosterPower))}<strong>{formatPower(p.change.newPower)}</strong>
                  {p.delta !== null && ` (${p.delta > 0 ? '+' : ''}${formatPercent(p.delta)})`}
                </p>
                <div className="toolbar">
                  <button type="button" className="button button--small button--primary" disabled={vm.busyId === p.change.id} onClick={() => void vm.approvePower(p.change)}>
                    {t().common.approve}
                  </button>
                  <button type="button" className="button button--small button--ghost" disabled={vm.busyId === p.change.id} onClick={() => void vm.rejectPower(p.change)}>
                    {t().common.reject}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function JoinRequestItem({ item, vm }: { item: JoinRequestView; vm: RequestsViewModel }) {
  const { request } = item;
  const [otherId, setOtherId] = useState('');
  const busy = vm.busyId === request.id;
  const m = t().requests;
  return (
    <li className="request">
      <div className="request__head">
        <strong>{request.name}</strong>
        <span className="muted small">{formatTimestamp(request.updatedAt)}</span>
      </div>
      <p className="small">
        {m.requestMeta(item.weekLabel, item.choicesLabel, formatPower(request.power))}
      </p>
      {item.suggestions.length > 0 && (
        <div className="toolbar">
          {item.suggestions.map((s) => (
            <button key={s.member.id} type="button" className="button button--small" disabled={busy} onClick={() => void vm.linkRequest(request, s.member.id)}>
              {m.thisIs(s.member.name)}
            </button>
          ))}
        </div>
      )}
      <div className="toolbar">
        <select className="input input--compact" value={otherId} onChange={(e) => setOtherId(e.target.value)} aria-label={m.linkOther}>
          <option value="">{m.otherMember}</option>
          {vm.members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <button type="button" className="button button--small" disabled={busy || !otherId} onClick={() => void vm.linkRequest(request, otherId)}>
          {m.link}
        </button>
      </div>
      <div className="toolbar">
        <button type="button" className="button button--small button--primary" disabled={busy} onClick={() => void vm.createFromRequest(request)}>
          {m.addNew}
        </button>
        <button type="button" className="button button--small button--danger-ghost" disabled={busy} onClick={() => void vm.rejectRequest(request)}>
          {t().common.reject}
        </button>
      </div>
      <p className="muted small">{m.linkHint(request.name)}</p>
    </li>
  );
}
