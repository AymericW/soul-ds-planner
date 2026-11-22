import { t } from '@/helpers/i18n';
import { EmptyState } from '@/components/EmptyState';
import { SearchInput } from '@/components/SearchInput';
import { Segmented } from '@/components/Segmented';
import { formatTimestamp } from '@/helpers/dates';
import { formatPower, parsePower } from '@/helpers/format';
import type { JoinChoice } from '@/models/JoinRequest';
import { RefreshAppLink } from '@/screens/AppUpdateSection';
import { useJoinViewModel, type JoinViewModel } from '@/viewmodels/useJoinViewModel';

const choiceOptions = (): ReadonlyArray<{ value: JoinChoice; label: string }> => [
  { value: 'none', label: t().join.choiceNone },
  { value: 'play', label: t().join.choicePlay },
  { value: 'sub', label: t().join.choiceSub },
];

const choiceText = (choice: JoinChoice): string =>
  ({ none: t().join.textNone, play: t().join.textPlay, sub: t().join.textSub })[choice];

/** Public page for players (no login, no leader navigation): `#/join?code=…`. */
export function JoinScreen() {
  const vm = useJoinViewModel();
  const m = t().join;

  if (vm.phase === 'loading') return <p className="muted">{t().common.loading}</p>;

  if (vm.phase === 'enterCode' || vm.phase === 'badCode') {
    return (
      <section className="screen join">
        <form
          className="card start-card"
          onSubmit={(e) => {
            e.preventDefault();
            vm.submitCode();
          }}
        >
          <h1 className="card__title">{m.title}</h1>
          <p className="muted">{m.enterCode}</p>
          {vm.phase === 'badCode' && (
            <div className="notice notice--danger" role="alert">
              {m.badCode}
            </div>
          )}
          {vm.error && (
            <div className="notice notice--danger" role="alert">
              {vm.error}
            </div>
          )}
          <label className="field">
            <span className="field__label">{m.allianceCode}</span>
            <input
              className="input"
              value={vm.codeInput}
              onChange={(e) => vm.setCodeInput(e.target.value)}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <button type="submit" className="button button--primary button--block" disabled={!vm.codeInput.trim()}>
            {m.continue}
          </button>
        </form>
      </section>
    );
  }

  if (vm.result) return <JoinDone vm={vm} />;

  if (!vm.anyOpen) {
    return (
      <section className="screen join">
        <EmptyState title={m.closedTitle}>
          <p>{m.closedText}</p>
        </EmptyState>
      </section>
    );
  }

  return (
    <section className="screen join">
      <div className="screen__head">
        <h1 className="screen__title">{m.signUpTitle}</h1>
        <p className="muted small">{m.signUpHint}</p>
      </div>

      <div className="card">
        <h2 className="card__title">{m.whoAreYou}</h2>
        {vm.mode === 'member' ? (
          vm.member ? (
            <div className="join__picked">
              <strong>{vm.member.name}</strong>
              <button type="button" className="button button--small button--ghost" onClick={() => void vm.pickMember(null)}>
                {t().common.change}
              </button>
            </div>
          ) : (
            <>
              <SearchInput value={vm.search} onChange={vm.setSearch} placeholder={m.findName} label={m.findNameLabel} />
              <ul className="pick-list join__list">
                {vm.matches.map((m) => (
                  <li key={m.id}>
                    <button type="button" className="pick-list__item" onClick={() => void vm.pickMember(m.id)}>
                      {m.name}
                    </button>
                  </li>
                ))}
                {vm.matches.length === 0 && <li className="muted small">{m.nobodyMatches(vm.search)}</li>}
              </ul>
            </>
          )
        ) : (
          <label className="field">
            <span className="field__label">{m.inGameName}</span>
            <input className="input" value={vm.unlistedName} onChange={(e) => vm.setUnlistedName(e.target.value)} autoComplete="off" maxLength={40} />
            <span className="field__hint">{m.inGameNameHint}</span>
            {vm.nameError && <span className="field__error">{vm.nameError}</span>}
          </label>
        )}
        <button
          type="button"
          className="button button--ghost button--small"
          onClick={() => {
            void vm.pickMember(null);
            vm.setMode(vm.mode === 'member' ? 'unlisted' : 'member');
          }}
        >
          {vm.mode === 'member' ? m.notInList : m.backToList}
        </button>
        {vm.previous?.submittedAt && (
          <div className="notice notice--info">
            {m.alreadySent(formatTimestamp(vm.previous.submittedAt), choiceText(vm.previous.choices.A), choiceText(vm.previous.choices.B))}
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="card__title">{m.powerTitle}</h2>
        <label className="field">
          <span className="field__label">{m.powerLabel}</span>
          <input
            className="input"
            value={vm.powerText}
            onChange={(e) => vm.setPowerText(e.target.value)}
            placeholder={t().common.powerPlaceholder}
            inputMode="decimal"
            autoComplete="off"
          />
          <span className="field__hint">
            {vm.powerText.trim() && parsePower(vm.powerText) !== undefined && !vm.powerError
              ? m.readAs(formatPower(parsePower(vm.powerText)!))
              : m.powerHint}
          </span>
          {vm.powerError && <span className="field__error">{vm.powerError}</span>}
        </label>
      </div>

      <div className="card">
        <h2 className="card__title">{m.thisFriday}</h2>
        {vm.events.map((e) => (
          <div key={e.slot} className="field join__event">
            <span className="field__label">
              {e.team} · {e.dateLabel} · {e.timeLabel}
            </span>
            {e.open ? (
              <Segmented label={e.team} value={vm.choices[e.slot]} options={choiceOptions()} onChange={(v) => vm.setChoice(e.slot, v)} />
            ) : (
              <span className="notice notice--warning">{m.closedFor(e.team)}</span>
            )}
          </div>
        ))}
        <p className="muted small">{m.choicesHint}</p>
      </div>

      {vm.error && (
        <div className="notice notice--danger" role="alert">
          {vm.error}
        </div>
      )}
      <div className="sticky-actions">
        <button type="button" className="button button--primary button--block" disabled={!vm.canSubmit} onClick={() => void vm.submit()}>
          {vm.submitting ? m.sending : vm.mode === 'member' ? (vm.previous?.submittedAt ? m.update : m.send) : m.sendRequest}
        </button>
      </div>
      <RefreshAppLink />
    </section>
  );
}

function JoinDone({ vm }: { vm: JoinViewModel }) {
  const r = vm.result!;
  const m = t().join;
  return (
    <section className="screen join">
      <EmptyState title={r.kind === 'registered' ? m.thanks : m.requestSent}>
        {r.kind === 'registered' ? (
          <>
            <p>
              <strong>{r.name}</strong>:{' '}
              {vm.events.map((e) => `${e.team} ${e.open ? choiceText(r.choices[e.slot]) : m.unchangedClosed}`).join(', ')}.
            </p>
            {r.power === 'pending' && (
              <p className="muted">{m.powerPending}</p>
            )}
            {r.power === 'applied' && <p className="muted">{m.powerApplied}</p>}
            <p className="muted small">{m.doneHint}</p>
            <button type="button" className="button" onClick={vm.startOver}>
              {m.changeAnswer}
            </button>
          </>
        ) : (
          <p>
            {m.requestedBefore} <strong>{r.name}</strong> {m.requestedAfter}
          </p>
        )}
      </EmptyState>
    </section>
  );
}
