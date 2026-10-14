import { EmptyState } from '@/components/EmptyState';
import { SearchInput } from '@/components/SearchInput';
import { Segmented } from '@/components/Segmented';
import { formatTimestamp } from '@/helpers/dates';
import { formatPower, parsePower } from '@/helpers/format';
import type { JoinChoice } from '@/models/JoinRequest';
import { RefreshAppLink } from '@/screens/AppUpdateSection';
import { useJoinViewModel, type JoinViewModel } from '@/viewmodels/useJoinViewModel';

const CHOICE_OPTIONS: ReadonlyArray<{ value: JoinChoice; label: string }> = [
  { value: 'none', label: 'Not available' },
  { value: 'play', label: 'Play' },
  { value: 'sub', label: 'Sub only' },
];

const CHOICE_TEXT: Record<JoinChoice, string> = { none: 'not available', play: 'available to play', sub: 'substitute only' };

/** Public page for players (no login, no leader navigation): `#/join?code=…`. */
export function JoinScreen() {
  const vm = useJoinViewModel();

  if (vm.phase === 'loading') return <p className="muted">Loading…</p>;

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
          <h1 className="card__title">Desert Storm registration</h1>
          <p className="muted">Enter the alliance code from the link the leaders shared.</p>
          {vm.phase === 'badCode' && (
            <div className="notice notice--danger" role="alert">
              This code is not valid (any more). Ask an R4 for the current link.
            </div>
          )}
          {vm.error && (
            <div className="notice notice--danger" role="alert">
              {vm.error}
            </div>
          )}
          <label className="field">
            <span className="field__label">Alliance code</span>
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
            Continue
          </button>
        </form>
      </section>
    );
  }

  if (vm.result) return <JoinDone vm={vm} />;

  if (!vm.anyOpen) {
    return (
      <section className="screen join">
        <EmptyState title="Registrations are closed">
          <p>The leaders have already planned this Friday’s events. If something changed, contact an R4 in the alliance chat.</p>
        </EmptyState>
      </section>
    );
  }

  return (
    <section className="screen join">
      <div className="screen__head">
        <h1 className="screen__title">Desert Storm – sign up</h1>
        <p className="muted small">
          Two events every Friday: register for one or both to raise your chance to play. You will play at most one of them per week.
        </p>
      </div>

      <div className="card">
        <h2 className="card__title">1. Who are you?</h2>
        {vm.mode === 'member' ? (
          vm.member ? (
            <div className="join__picked">
              <strong>{vm.member.name}</strong>
              <button type="button" className="button button--small button--ghost" onClick={() => void vm.pickMember(null)}>
                Change
              </button>
            </div>
          ) : (
            <>
              <SearchInput value={vm.search} onChange={vm.setSearch} placeholder="Find your name…" label="Find your name" />
              <ul className="pick-list join__list">
                {vm.matches.map((m) => (
                  <li key={m.id}>
                    <button type="button" className="pick-list__item" onClick={() => void vm.pickMember(m.id)}>
                      {m.name}
                    </button>
                  </li>
                ))}
                {vm.matches.length === 0 && <li className="muted small">Nobody matches “{vm.search}”.</li>}
              </ul>
            </>
          )
        ) : (
          <label className="field">
            <span className="field__label">Your in-game name</span>
            <input className="input" value={vm.unlistedName} onChange={(e) => vm.setUnlistedName(e.target.value)} autoComplete="off" maxLength={40} />
            <span className="field__hint">The leaders will add you to the roster and confirm your registration.</span>
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
          {vm.mode === 'member' ? 'I’m not in the list' : 'Back to the list of names'}
        </button>
        {vm.previous?.submittedAt && (
          <div className="notice notice--info">
            You already sent this form on {formatTimestamp(vm.previous.submittedAt)}: Team A {CHOICE_TEXT[vm.previous.choices.A]}, Team B{' '}
            {CHOICE_TEXT[vm.previous.choices.B]}. Sending again updates your answer.
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="card__title">2. Your current T1 power</h2>
        <label className="field">
          <span className="field__label">T1 power</span>
          <input
            className="input"
            value={vm.powerText}
            onChange={(e) => vm.setPowerText(e.target.value)}
            placeholder="e.g. 152.3M"
            inputMode="decimal"
            autoComplete="off"
          />
          <span className="field__hint">
            {vm.powerText.trim() && parsePower(vm.powerText) !== undefined && !vm.powerError
              ? `Read as ${formatPower(parsePower(vm.powerText)!)}.`
              : 'Write it like 152.3M or 152300000 (numbers below 100 000 are read as millions).'}
          </span>
          {vm.powerError && <span className="field__error">{vm.powerError}</span>}
        </label>
      </div>

      <div className="card">
        <h2 className="card__title">3. This Friday</h2>
        {vm.events.map((e) => (
          <div key={e.slot} className="field join__event">
            <span className="field__label">
              {e.team} · {e.dateLabel} · {e.timeLabel}
            </span>
            {e.open ? (
              <Segmented label={e.team} value={vm.choices[e.slot]} options={CHOICE_OPTIONS} onChange={(v) => vm.setChoice(e.slot, v)} />
            ) : (
              <span className="notice notice--warning">Registrations closed for {e.team} (sign-ups end Wednesday 10 PM (22h) Paris time).</span>
            )}
          </div>
        ))}
        <p className="muted small">
          “Play”: you can be picked as a starter; if not, you may be a substitute. “Sub only”: only as a substitute. Choosing “Play” for both is fine:
          you will be placed in one of them. Sign-ups close Wednesday 10 PM (22h) Paris time.
        </p>
      </div>

      {vm.error && (
        <div className="notice notice--danger" role="alert">
          {vm.error}
        </div>
      )}
      <div className="sticky-actions">
        <button type="button" className="button button--primary button--block" disabled={!vm.canSubmit} onClick={() => void vm.submit()}>
          {vm.submitting ? 'Sending…' : vm.mode === 'member' ? (vm.previous?.submittedAt ? 'Update my answer' : 'Send') : 'Send request'}
        </button>
      </div>
      <RefreshAppLink />
    </section>
  );
}

function JoinDone({ vm }: { vm: JoinViewModel }) {
  const r = vm.result!;
  return (
    <section className="screen join">
      <EmptyState title={r.kind === 'registered' ? 'Thank you, you are registered!' : 'Request sent'}>
        {r.kind === 'registered' ? (
          <>
            <p>
              <strong>{r.name}</strong>:{' '}
              {vm.events.map((e) => `${e.team} ${e.open ? CHOICE_TEXT[r.choices[e.slot]] : 'unchanged (closed)'}`).join(', ')}.
            </p>
            {r.power === 'pending' && (
              <p className="muted">Your new power is quite different from the roster, so a leader will check it before updating the roster.</p>
            )}
            {r.power === 'applied' && <p className="muted">Your power was updated in the roster.</p>}
            <p className="muted small">The lineups are published in the alliance chat. You can come back to this link to change your answer until then.</p>
            <button type="button" className="button" onClick={vm.startOver}>
              Change my answer
            </button>
          </>
        ) : (
          <p>
            The leaders will add <strong>{r.name}</strong> to the roster and confirm your registration. No need to send it again.
          </p>
        )}
      </EmptyState>
    </section>
  );
}
