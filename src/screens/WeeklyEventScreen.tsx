import { useState } from 'react';
import { AttendanceList } from '@/components/AttendanceList';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EarlyRunSheet } from '@/components/EarlyRunSheet';
import { EmptyState } from '@/components/EmptyState';
import { CameraIcon, ClockIcon, CopyIcon, LinkIcon, PlusIcon } from '@/components/Icons';
import { MemberChecklist } from '@/components/MemberChecklist';
import { MemberForm } from '@/components/MemberForm';
import { Modal } from '@/components/Modal';
import { PlayerActionSheet } from '@/components/PlayerActionSheet';
import { PowerEditor } from '@/components/PowerEditor';
import { RegistrationSheet } from '@/components/RegistrationSheet';
import { ScreenshotUploader } from '@/components/ScreenshotUploader';
import { SignupList } from '@/components/SignupList';
import { SlotBoard } from '@/components/SlotBoard';
import { StepIndicator } from '@/components/StepIndicator';
import { UnmatchedNames } from '@/components/UnmatchedNames';
import { ROUTES, type RouteId } from '@/constants/routes';
import { formatEventDate, formatTimestamp } from '@/helpers/dates';
import { formatPower, pluralise } from '@/helpers/format';
import { useWeeklyEventViewModel, type WeeklyEventViewModel, type WizardStep } from '@/viewmodels/useWeeklyEventViewModel';

const STATUS_LABEL = {
  registration: 'Registration',
  planned: 'Plan ready',
  locked: 'Locked',
  finalised: 'Finalised',
} as const;

const STEP_LABELS: Record<WizardStep, string> = { 1: 'Poll', 2: 'Lineup', 3: 'Share', 4: 'Attend' };

export function WeeklyEventScreen({ onNavigate }: { onNavigate: (route: RouteId) => void }) {
  const vm = useWeeklyEventViewModel();
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  if (vm.loading) return <p className="muted">Loading…</p>;

  if (!vm.hasMembers) {
    return (
      <section className="screen">
        <h1 className="screen__title">This week</h1>
        <EmptyState title="Start with your roster">
          <p>Add or import the alliance members first – then come back to plan Desert Storm.</p>
          <button type="button" className="button button--primary" onClick={() => onNavigate(ROUTES.roster)}>
            Open roster
          </button>
        </EmptyState>
      </section>
    );
  }

  if (!vm.event) return <StartWeek vm={vm} onNavigate={onNavigate} />;

  const event = vm.event;
  const finalised = event.status === 'finalised';
  return (
    <section className="screen screen--event">
      <div className="event-head">
        <div>
          <span className="eyebrow">Desert Storm</span>
          <h1 className="screen__title">{formatEventDate(event.date)}</h1>
        </div>
        <span className={`status-chip status-chip--${event.status}`}>{STATUS_LABEL[event.status]}</span>
      </div>
      {vm.weekOptions.length > 1 && (
        <label className="field">
          <span className="field__label">Week</span>
          <select className="input" value={vm.weekKey ?? ''} onChange={(e) => vm.chooseWeek(e.target.value)}>
            {vm.weekOptions.map((w) => (
              <option key={w.key} value={w.key}>
                {w.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="team-switch" role="tablist" aria-label="Event">
        {vm.eventTabs.map((t) => (
          <button
            key={t.slot}
            type="button"
            role="tab"
            aria-selected={t.slot === vm.slot}
            className={`team-switch__item${t.slot === vm.slot ? ' is-selected' : ''}`}
            onClick={() => (t.status ? vm.selectSlot(t.slot) : void vm.startNewWeek(event.date))}
          >
            <span className="team-switch__team">{t.team}</span>
            <span className="team-switch__meta">
              {t.status ? `${t.shortTime} · ${t.registered}` : 'tap to create'}
              {t.status === 'finalised' && ' · done'}
            </span>
          </button>
        ))}
      </div>
      {finalised ? (
        <div className="notice notice--success">
          <span>{vm.team} is finalised: attendance and penalties are in the history.</span>
          <button type="button" className="button button--small" onClick={() => onNavigate(ROUTES.history)}>
            View history
          </button>
        </div>
      ) : (
        <>
          <StepIndicator
            steps={([1, 2, 3, 4] as WizardStep[]).map((id) => ({ id, label: STEP_LABELS[id], enabled: vm.unlockedSteps[id] }))}
            current={vm.step}
            onSelect={(id) => vm.setStep(id as WizardStep)}
          />
          {vm.step === 1 && <PollStep vm={vm} />}
          {vm.step === 2 && <SelectionStep vm={vm} />}
          {vm.step === 3 && <ShareStep vm={vm} />}
          {vm.step === 4 && <AttendanceStep vm={vm} />}
          <button type="button" className="button button--danger-ghost button--small discard" onClick={() => setConfirmDiscard(true)}>
            Cancel / delete {vm.team} of this week
          </button>
        </>
      )}
      {confirmDiscard && (
        <ConfirmDialog
          title={`Delete ${vm.team} of this week?`}
          message={`${vm.team} of ${formatEventDate(event.date)}, with its registrations, lineup and attendance, will be deleted. The other event, past weeks and penalties are not affected. Events of the upcoming Friday are created again automatically (empty) the next time the app or the join page opens.`}
          confirmLabel="Delete event"
          danger
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={async () => {
            await vm.discardEvent();
            setConfirmDiscard(false);
          }}
        />
      )}
    </section>
  );
}

function StartWeek({ vm, onNavigate }: { vm: WeeklyEventViewModel; onNavigate: (route: RouteId) => void }) {
  const [date, setDate] = useState(vm.defaultDate);
  return (
    <section className="screen">
      <h1 className="screen__title">This week</h1>
      {vm.previousSummary && (
        <div className="notice notice--success">
          <div>
            <strong>Last week finalised:</strong> {vm.previousSummary.label}. {pluralise(vm.previousSummary.played, 'player')} played (Team A + Team B).
            {vm.previousSummary.suspendedNames.length > 0
              ? ` Suspended: ${vm.previousSummary.suspendedNames.join(', ')}.`
              : ' No penalties.'}
          </div>
          <button type="button" className="button button--small" onClick={() => onNavigate(ROUTES.history)}>
            View history
          </button>
        </div>
      )}
      <div className="card start-card">
        <h2 className="card__title">Start a new week</h2>
        <p className="muted">
          Every Friday has two events: Team A ({vm.eventTabs[0]?.timeLabel}) and Team B ({vm.eventTabs[1]?.timeLabel}). They are created
          automatically for the upcoming Friday; use this only for another date. Each event: {vm.settings.coreStarters} core +{' '}
          {vm.settings.rotationStarters} rotation starters, {vm.settings.substitutes} substitutes = {vm.cap} places. A player plays at most one
          event per week. History and suspensions from previous weeks are applied automatically.
        </p>
        <label className="field">
          <span className="field__label">Event date (Friday)</span>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <button type="button" className="button button--primary button--block" disabled={!date} onClick={() => void vm.startNewWeek(date)}>
          Create Team A and Team B
        </button>
      </div>
    </section>
  );
}

function PollStep({ vm }: { vm: WeeklyEventViewModel }) {
  const [adding, setAdding] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmBoth, setConfirmBoth] = useState(false);
  const [confirmRun, setConfirmRun] = useState(false);
  const [sheetFor, setSheetFor] = useState<string | null>(null);
  const [editingPower, setEditingPower] = useState<string | null>(null);
  const editingItem = editingPower ? vm.registrationItems.find((i) => i.memberId === editingPower) : undefined;
  const sheetItem = sheetFor ? vm.registrationItems.find((i) => i.memberId === sheetFor) : undefined;
  const rerun = vm.event?.status === 'planned';
  const registration = vm.event?.status === 'registration';
  const early = vm.registrationStillOpen;
  const ocr = vm.pollOcr;
  const importVisible = showImport || ocr.status !== 'idle' || Boolean(ocr.imageUrl);

  const runSelection = async (scope: 'this' | 'both') => {
    await vm.runWeeklySelection(scope);
    setConfirmRun(false);
    setConfirmBoth(false);
  };

  return (
    <div className="step">
      {!vm.editable && (
        <div className="notice notice--info">Attendance has started, so the lineup is frozen. Go back to planning in step 4 to change registrations.</div>
      )}
      {registration && (
        <div className={`join-strip${early ? '' : ' is-closed'}`}>
          <ClockIcon size={18} />
          <span className="join-strip__text">
            {early ? (
              <>
                Join link open · closes <strong>{vm.registrationCloseShort}</strong> (in {vm.registrationClosesIn})
              </>
            ) : (
              <>
                Registration closed <strong>{vm.registrationCloseShort}</strong> – ready to run the selection
              </>
            )}
            {!vm.joinLink && <span className="muted"> · set a join code in Settings to share a join link</span>}
          </span>
          {vm.joinLink && early && (
            <button type="button" className="button button--ghost button--small" onClick={vm.openJoinPage}>
              Sign up myself
            </button>
          )}
          {vm.joinLink && (
            <button type="button" className="icon-tile icon-tile--small" aria-label="Copy join link" onClick={() => void vm.copyJoinLink()}>
              <LinkIcon size={18} />
            </button>
          )}
        </div>
      )}
      {importVisible && (
        <ScreenshotUploader
          title="Import poll screenshot"
          hint="Screenshot the in-game poll (the players who voted Yes). Names found are ticked automatically."
          imageUrl={ocr.imageUrl}
          status={ocr.status}
          progressLabel={ocr.progressLabel}
          progress={ocr.progress}
          message={ocr.message}
          disabled={!vm.editable}
          onFile={(f) => void ocr.run(f)}
          onTrySample={import.meta.env.DEV ? () => void vm.tryPollSample() : undefined}
          onClear={() => {
            ocr.clear();
            setShowImport(false);
          }}
        />
      )}
      <UnmatchedNames
        unmatched={ocr.unmatched}
        members={vm.registrationItems.map((i) => ({ id: i.memberId, name: i.name }))}
        onAssign={(guess, id) => void vm.assignUnmatched(guess, id, 'poll')}
        onDismiss={ocr.dismissUnmatched}
      />
      <MemberChecklist
        checkedLabel="Registered"
        disabled={!vm.editable}
        onSelect={setSheetFor}
        actions={
          <>
            <button
              type="button"
              className={`icon-tile${importVisible ? ' is-active' : ''}`}
              aria-label="Import poll screenshot"
              aria-pressed={importVisible}
              disabled={!vm.editable}
              onClick={() => setShowImport((v) => !v)}
            >
              <CameraIcon />
            </button>
            <button type="button" className="icon-tile" aria-label="Add new member" disabled={!vm.editable} onClick={() => setAdding(true)}>
              <PlusIcon />
            </button>
          </>
        }
        items={vm.registrationItems.map((i) => ({
          id: i.memberId,
          name: i.name,
          power: i.power,
          checked: i.registered,
          substituteOnly: i.substituteOnly,
          fromOcr: i.fromOcr,
          warning: i.inactive ? 'Inactive' : i.suspendedFor > 0 ? `Suspended (${i.suspendedFor})` : undefined,
          badges: [
            ...(i.registered && i.selfRegistered ? [{ label: 'Self-registered', tone: 'rank' as const }] : []),
            ...(i.otherEventNote ? [{ label: i.otherEventNote, tone: 'muted' as const }] : []),
          ],
          detail:
            i.registered && i.selfRegistered
              ? `${i.submittedAt ? `Sent ${formatTimestamp(i.submittedAt)}` : 'Sent'}${i.enteredPower !== undefined ? ` · entered ${formatPower(i.enteredPower)}` : ''}${i.powerPending ? ' · power change waiting for review' : ''}`
              : i.powerPending
                ? 'Power change waiting for review'
                : undefined,
          detailWarning: i.powerPending,
        }))}
      />
      <div className="step-extras">
        <details className="hint-details">
          <summary className="muted small">How to fill this list</summary>
          <p className="muted small">
            Tap a member to tick everyone who voted for {vm.team} – including forgotten voters. In the same sheet, switch on “Sub only” for those who
            voted to be a substitute: they are never picked as starters. Inactive or suspended members can be ticked but will not be selected.
            Players who used the join link are already ticked (“Self-registered”); you can still untick them or fix their power.
          </p>
        </details>
        <div className="step-extras__actions">
          {vm.canRunBoth && (
            <button type="button" className="button button--ghost button--small" onClick={() => setConfirmBoth(true)}>
              Run Team A and Team B together
            </button>
          )}
          <button
            type="button"
            className="button button--ghost button--small"
            onClick={() => setConfirmClear(true)}
            disabled={!vm.editable || vm.registeredCount === 0}
          >
            Untick all
          </button>
        </div>
      </div>
      {vm.editable && (
        <div className="action-bar">
          <div className="action-bar__summary">
            <strong>
              {vm.registeredCount} registered
              {vm.substituteOnlyCount > 0 && <span className="muted"> ({vm.substituteOnlyCount} sub only)</span>}
            </strong>
            {registration && early ? (
              <span className="is-warning">Join link open – wait until {vm.registrationCloseShort}</span>
            ) : (
              <span>
                {vm.cap} places · {vm.starters} starters + {vm.settings.substitutes} subs
              </span>
            )}
          </div>
          <button type="button" className="button button--primary" disabled={vm.registeredCount === 0} onClick={() => setConfirmRun(true)}>
            {rerun ? 'Re-run selection' : 'Run selection'}
          </button>
        </div>
      )}
      {sheetItem && (
        <RegistrationSheet
          name={sheetItem.name}
          power={sheetItem.power}
          team={vm.team}
          registered={sheetItem.registered}
          substituteOnly={sheetItem.substituteOnly}
          detail={[
            sheetItem.registered ? (sheetItem.selfRegistered ? 'Self-registered' : sheetItem.fromOcr ? 'From screenshot' : 'Ticked by an R4') : null,
            sheetItem.submittedAt ? `Sent ${formatTimestamp(sheetItem.submittedAt)}` : null,
            sheetItem.otherEventNote ?? null,
          ]
            .filter(Boolean)
            .join(' · ')}
          warning={sheetItem.inactive ? 'Inactive' : sheetItem.suspendedFor > 0 ? `Suspended (${sheetItem.suspendedFor})` : undefined}
          onClose={() => setSheetFor(null)}
          onToggle={async () => {
            await vm.toggleRegistration(sheetItem.memberId);
            setSheetFor(null);
          }}
          onToggleSubstitute={() => vm.toggleSubstituteOnly(sheetItem.memberId)}
          onEditPower={() => {
            setSheetFor(null);
            setEditingPower(sheetItem.memberId);
          }}
        />
      )}
      {editingItem && (
        <Modal title={`Power – ${editingItem.name}`} onClose={() => setEditingPower(null)}>
          <PowerEditor
            name={editingItem.name}
            currentPower={editingItem.power}
            enteredPower={editingItem.enteredPower}
            onCancel={() => setEditingPower(null)}
            onSave={async (power) => {
              await vm.updateMemberPower(editingItem.memberId, power);
              setEditingPower(null);
            }}
          />
        </Modal>
      )}
      {confirmRun &&
        (!rerun && early ? (
          <EarlyRunSheet
            teams={vm.team}
            closesIn={vm.registrationClosesIn}
            closeLabel={vm.registrationCloseLabel}
            confirmLabel="Run selection anyway"
            onCancel={() => setConfirmRun(false)}
            onConfirm={() => runSelection('this')}
          />
        ) : (
          <ConfirmDialog
            title={rerun ? `Re-run the selection for ${vm.team}?` : `Run the selection for ${vm.team}?`}
            message={
              <>
                <p>
                  {rerun
                    ? 'The plan is recalculated from the current registrations. Manual moves and swaps are lost.'
                    : `The lineup is built from the ${pluralise(vm.registeredCount, 'registered player')}, and self-registration with the join link closes for ${vm.team}.`}
                </p>
                {!rerun && <p className="muted small">Registrations closed on {vm.registrationCloseLabel}.</p>}
              </>
            }
            confirmLabel={rerun ? 'Re-run selection' : 'Run selection'}
            onCancel={() => setConfirmRun(false)}
            onConfirm={() => runSelection('this')}
          />
        ))}
      {confirmBoth &&
        (early ? (
          <EarlyRunSheet
            teams="Team A and Team B"
            closesIn={vm.registrationClosesIn}
            closeLabel={vm.registrationCloseLabel}
            confirmLabel="Run both anyway"
            onCancel={() => setConfirmBoth(false)}
            onConfirm={() => runSelection('both')}
          />
        ) : (
          <ConfirmDialog
            title="Plan Team A and Team B together?"
            message="Both lineups are recomputed from their registrations so that nobody is in both (the event with fewer players gets first pick). Manual moves and swaps in both events are lost."
            confirmLabel="Run both"
            onCancel={() => setConfirmBoth(false)}
            onConfirm={() => runSelection('both')}
          />
        ))}
      {adding && (
        <Modal title="Add new member" onClose={() => setAdding(false)}>
          <MemberForm
            onCancel={() => setAdding(false)}
            onSubmit={async (draft) => {
              const errors = await vm.quickAddMember(draft);
              if (Object.keys(errors).length === 0) setAdding(false);
              return errors;
            }}
          />
        </Modal>
      )}
      {confirmClear && (
        <ConfirmDialog
          title="Untick everyone?"
          message={`All registrations for ${vm.team} of this week will be removed.`}
          confirmLabel="Untick all"
          danger
          onCancel={() => setConfirmClear(false)}
          onConfirm={async () => {
            await vm.clearAllRegistrations();
            setConfirmClear(false);
          }}
        />
      )}
    </div>
  );
}

function SelectionStep({ vm }: { vm: WeeklyEventViewModel }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmRerun, setConfirmRerun] = useState(false);
  const all = [...vm.board.core, ...vm.board.rotation, ...vm.board.substitute, ...vm.board.notSelected];
  const player = selected ? all.find((p) => p.memberId === selected) : undefined;
  const { lateAdds, withdrawn } = vm.drift;
  const stats = [
    { slot: 'core', label: 'Core', count: vm.board.core.length, cap: vm.settings.coreStarters },
    { slot: 'rotation', label: 'Rotation', count: vm.board.rotation.length, cap: vm.settings.rotationStarters },
    { slot: 'substitute', label: 'Subs', count: vm.board.substitute.length, cap: vm.settings.substitutes },
  ];

  return (
    <div className="step">
      <div className="lineup-stats">
        {stats.map((s) => (
          <div key={s.slot} className={`lineup-stat slot--${s.slot}`}>
            <span className="lineup-stat__label">{s.label}</span>
            <span className="lineup-stat__value">
              {s.count}
              <span className="muted">/{s.cap}</span>
            </span>
          </div>
        ))}
      </div>
      {(lateAdds.length > 0 || withdrawn.length > 0) && vm.editable && (
        <div className="notice notice--warning">
          <span>
            Registrations changed since the selection ({lateAdds.length} added, {withdrawn.length} removed).
          </span>
          <button type="button" className="button button--small" onClick={() => void vm.keepPlanWithLateChanges()}>
            Keep plan, add late ones as subs
          </button>
          <button type="button" className="button button--small" onClick={() => setConfirmRerun(true)}>
            Re-run selection
          </button>
        </div>
      )}
      <p className="muted small step-hint">
        {vm.editable ? 'Tap a player to move or swap them.' : 'Attendance has started, so the lineup is frozen.'}
        {vm.board.notSelected.length > 0 && ` ${vm.board.notSelected.length} not selected.`} A player is never in both lineups of the week.
      </p>
      <SlotBoard
        board={vm.board}
        capacity={{ core: vm.settings.coreStarters, rotation: vm.settings.rotationStarters, substitute: vm.settings.substitutes }}
        onSelectPlayer={vm.editable ? setSelected : undefined}
        selectedId={selected}
      />
      <div className="action-bar action-bar--row">
        {vm.editable && (
          <button type="button" className="button" onClick={() => (vm.hasOverrides ? setConfirmRerun(true) : void vm.runWeeklySelection())}>
            Re-run
          </button>
        )}
        <button type="button" className="button button--primary" onClick={() => vm.setStep(3)}>
          Next: share plan
        </button>
      </div>
      {player && (
        <PlayerActionSheet
          player={player}
          others={all}
          onClose={() => setSelected(null)}
          onMove={(to) => {
            void vm.movePlayer(player.memberId, to);
            setSelected(null);
          }}
          onSwap={(other) => {
            void vm.swapPlayers(player.memberId, other);
            setSelected(null);
          }}
        />
      )}
      {confirmRerun && (
        <ConfirmDialog
          title="Re-run the selection?"
          message="The plan is recalculated from the current registrations. Manual moves and swaps are lost."
          confirmLabel="Re-run"
          onCancel={() => setConfirmRerun(false)}
          onConfirm={async () => {
            await vm.runWeeklySelection();
            setConfirmRerun(false);
          }}
        />
      )}
    </div>
  );
}

function ShareStep({ vm }: { vm: WeeklyEventViewModel }) {
  const [confirmEarly, setConfirmEarly] = useState(false);
  const event = vm.event;
  const locked = event?.status === 'locked';
  const lineup = vm.board.core.length + vm.board.rotation.length + vm.board.substitute.length;
  const eventDay = event ? formatEventDate(event.date).split(' ')[0] : '';
  return (
    <div className="step">
      <div className="section-head">
        <h2 className="section-head__title">In-game sign-up list</h2>
        <span className="muted small">{pluralise(lineup, 'player')}</span>
      </div>
      <SignupList
        board={vm.board}
        capacity={{ core: vm.settings.coreStarters, rotation: vm.settings.rotationStarters, substitute: vm.settings.substitutes }}
      />
      <details className="hint-details">
        <summary className="muted small">Plan text for the alliance chat</summary>
        <pre className="plan-text">{vm.planText}</pre>
      </details>
      {!locked && !vm.eventOver && (
        <div className="step-extras__actions">
          <button type="button" className="button button--ghost button--small" onClick={() => setConfirmEarly(true)}>
            Event already played? Open attendance anyway
          </button>
        </div>
      )}
      <div className="action-bar action-bar--row">
        <button type="button" className="button" onClick={() => void vm.copyPlan()}>
          <CopyIcon size={18} /> Copy plan
        </button>
        {locked ? (
          <button type="button" className="button button--primary" onClick={() => vm.setStep(4)}>
            Go to attendance
          </button>
        ) : (
          <button type="button" className="button button--primary" disabled={!vm.eventOver} onClick={() => void vm.startAttendance()}>
            {vm.eventOver ? 'Record attendance' : `Attendance ${eventDay}`}
          </button>
        )}
      </div>
      {confirmEarly && (
        <ConfirmDialog
          title="Open attendance early?"
          message="The event date has not arrived yet. This freezes the lineup until you go back to planning."
          confirmLabel="Open attendance"
          onCancel={() => setConfirmEarly(false)}
          onConfirm={async () => {
            await vm.startAttendance();
            setConfirmEarly(false);
          }}
        />
      )}
    </div>
  );
}

function AttendanceStep({ vm }: { vm: WeeklyEventViewModel }) {
  const [confirm, setConfirm] = useState(false);
  const ocr = vm.attendanceOcr;
  const s = vm.attendanceSummary;
  return (
    <div className="step">
      <div className="join-strip">
        <span className="join-strip__text">Lineup is frozen while attendance is recorded.</span>
        <button type="button" className="button button--small" onClick={() => void vm.unlockPlan()}>
          Back to planning
        </button>
      </div>
      <ScreenshotUploader
        title="Participation screenshot"
        hint={`After the event, screenshot the ${vm.team} participant list. Players found are marked as entered.`}
        imageUrl={ocr.imageUrl}
        status={ocr.status}
        progressLabel={ocr.progressLabel}
        progress={ocr.progress}
        message={ocr.message}
        onFile={(f) => void ocr.run(f)}
        onTrySample={import.meta.env.DEV ? () => void vm.tryAttendanceSample() : undefined}
        onClear={ocr.clear}
      />
      <UnmatchedNames
        title="Not matched to this week's lineup"
        hint="These names are not core, rotation or substitutes this week (or were misread). Tap one only if it is a lineup player with a different spelling; otherwise ignore it."
        unmatched={ocr.unmatched}
        members={vm.attendanceItems.map((i) => ({ id: i.memberId, name: i.name }))}
        onAssign={(guess, id) => void vm.assignUnmatched(guess, id, 'attendance')}
        onDismiss={ocr.dismissUnmatched}
      />
      <AttendanceList
        rows={vm.attendanceItems}
        suspensionEvents={vm.settings.suspensionEvents}
        onToggleAttended={(id) => void vm.toggleAttended(id)}
        onSetNotified={(id, v) => void vm.setMemberNotified(id, v)}
      />
      <div className={`notice ${vm.penaltyPreview.length ? 'notice--danger' : 'notice--success'}`}>
        {vm.penaltyPreview.length
          ? `On finalising, ${vm.penaltyPreview.map((p) => p.name).join(', ')} will be suspended for ${pluralise(vm.settings.suspensionEvents, 'event')}.`
          : 'No penalties: every absent starter notified an R4.'}
      </div>
      <div className="action-bar">
        <div className="action-bar__summary">
          <strong>
            Starters {s.startersPresent}/{s.starters}
          </strong>
          <span>{pluralise(s.subsUsed, 'substitute')} used</span>
        </div>
        <button type="button" className="button button--primary" onClick={() => setConfirm(true)}>
          Finalise event
        </button>
      </div>
      {confirm && (
        <ConfirmDialog
          title="Finalise this event?"
          message={
            <>
              <p>This records attendance in the history, updates rotation priority, counts down existing suspensions by one event{vm.penaltyPreview.length ? ' and suspends the no-shows listed' : ''}.</p>
              <p className="muted small">A finalised event cannot be edited.</p>
            </>
          }
          confirmLabel="Finalise"
          onCancel={() => setConfirm(false)}
          onConfirm={async () => {
            await vm.finalise();
            setConfirm(false);
          }}
        />
      )}
    </div>
  );
}
