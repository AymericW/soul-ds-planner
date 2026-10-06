import { useState } from 'react';
import { AttendanceList } from '@/components/AttendanceList';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { MemberChecklist } from '@/components/MemberChecklist';
import { MemberForm } from '@/components/MemberForm';
import { Modal } from '@/components/Modal';
import { PlayerActionSheet } from '@/components/PlayerActionSheet';
import { ScreenshotUploader } from '@/components/ScreenshotUploader';
import { SlotBoard } from '@/components/SlotBoard';
import { StepIndicator } from '@/components/StepIndicator';
import { UnmatchedNames } from '@/components/UnmatchedNames';
import { ROUTES, type RouteId } from '@/constants/routes';
import { formatEventDate } from '@/helpers/dates';
import { pluralise } from '@/helpers/format';
import { useWeeklyEventViewModel, type WeeklyEventViewModel, type WizardStep } from '@/viewmodels/useWeeklyEventViewModel';

const STATUS_LABEL = {
  registration: 'Registration',
  planned: 'Plan ready',
  locked: 'Locked',
  finalised: 'Finalised',
} as const;

const STEP_LABELS: Record<WizardStep, string> = { 1: 'Poll', 2: 'Lineup', 3: 'Share', 4: 'Attendance' };

export function WeeklyEventScreen({ onNavigate }: { onNavigate: (route: RouteId) => void }) {
  const vm = useWeeklyEventViewModel();

  if (vm.loading) return <p className="muted">Loading…</p>;

  if (!vm.hasMembers) {
    return (
      <section className="screen">
        <h1 className="screen__title">This week</h1>
        <EmptyState title="Start with your roster">
          <p>Add or import the alliance members first (or load the demo roster) – then come back to plan Desert Storm.</p>
          <button type="button" className="button button--primary" onClick={() => onNavigate(ROUTES.roster)}>
            Open roster
          </button>
        </EmptyState>
      </section>
    );
  }

  if (!vm.event) return <StartWeek vm={vm} onNavigate={onNavigate} />;

  const event = vm.event;
  return (
    <section className="screen">
      <div className="screen__head event-head">
        <div>
          <h1 className="screen__title">{formatEventDate(event.date)}</h1>
          <p className="muted small">
            Desert Storm · Team A · <span className={`badge status status--${event.status}`}>{STATUS_LABEL[event.status]}</span>
          </p>
        </div>
      </div>
      <StepIndicator
        steps={([1, 2, 3, 4] as WizardStep[]).map((id) => ({ id, label: STEP_LABELS[id], enabled: vm.unlockedSteps[id] }))}
        current={vm.step}
        onSelect={(id) => vm.setStep(id as WizardStep)}
      />
      {vm.step === 1 && <PollStep vm={vm} />}
      {vm.step === 2 && <SelectionStep vm={vm} />}
      {vm.step === 3 && <ShareStep vm={vm} />}
      {vm.step === 4 && <AttendanceStep vm={vm} />}
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
            <strong>Last event finalised:</strong> {vm.previousSummary.label}. {pluralise(vm.previousSummary.played, 'player')} played.
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
          Rules: {vm.settings.coreStarters} core + {vm.settings.rotationStarters} rotation starters, {vm.settings.substitutes} substitutes (cap{' '}
          {vm.cap}). History and suspensions from previous weeks are applied automatically.
        </p>
        <label className="field">
          <span className="field__label">Event date</span>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <button type="button" className="button button--primary button--block" disabled={!date} onClick={() => void vm.startNewEvent(date)}>
          Start week
        </button>
      </div>
    </section>
  );
}

function PollStep({ vm }: { vm: WeeklyEventViewModel }) {
  const [adding, setAdding] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const ocr = vm.pollOcr;
  return (
    <div className="step">
      {!vm.editable && (
        <div className="notice notice--info">Attendance has started, so the lineup is frozen. Go back to planning in step 4 to change registrations.</div>
      )}
      <ScreenshotUploader
        title="1. Poll screenshot"
        hint="Screenshot the in-game poll (the list of players who voted Yes). Names found are ticked automatically."
        imageUrl={ocr.imageUrl}
        status={ocr.status}
        progressLabel={ocr.progressLabel}
        progress={ocr.progress}
        message={ocr.message}
        disabled={!vm.editable}
        onFile={(f) => void ocr.run(f)}
        onTrySample={() => void vm.tryPollSample()}
        onClear={ocr.clear}
      />
      <UnmatchedNames
        unmatched={ocr.unmatched}
        members={vm.registrationItems.map((i) => ({ id: i.memberId, name: i.name }))}
        onAssign={(guess, id) => void vm.assignUnmatched(guess, id, 'poll')}
        onDismiss={ocr.dismissUnmatched}
      />
      <div className="card">
        <div className="card__row">
          <h3 className="card__title">Registered: {vm.registeredCount}</h3>
          <span className="muted small">
            cap {vm.cap} ({vm.starters} starters + {vm.settings.substitutes} subs)
          </span>
        </div>
        <p className="muted small">Tick everyone who voted – including forgotten voters. Inactive or suspended members can be ticked but will not be selected.</p>
        <div className="toolbar">
          <button type="button" className="button" onClick={() => setAdding(true)} disabled={!vm.editable}>
            + New member
          </button>
          <button type="button" className="button button--ghost" onClick={() => setConfirmClear(true)} disabled={!vm.editable || vm.registeredCount === 0}>
            Untick all
          </button>
        </div>
        <MemberChecklist
          checkedLabel="Registered"
          disabled={!vm.editable}
          onToggle={(id) => void vm.toggleRegistration(id)}
          items={vm.registrationItems.map((i) => ({
            id: i.memberId,
            name: i.name,
            power: i.power,
            checked: i.registered,
            fromOcr: i.fromOcr,
            warning: i.inactive ? 'Inactive' : i.suspendedFor > 0 ? `Suspended (${i.suspendedFor})` : undefined,
          }))}
        />
      </div>
      <div className="sticky-actions">
        {vm.editable && (
          <button type="button" className="button button--primary button--block" disabled={vm.registeredCount === 0} onClick={() => void vm.runWeeklySelection()}>
            {vm.event?.status === 'planned' ? 'Re-run selection' : 'Run selection'} ({vm.registeredCount} registered)
          </button>
        )}
      </div>
      {vm.event?.status === 'registration' && (
        <button type="button" className="button button--danger-ghost button--small discard" onClick={() => setConfirmDiscard(true)}>
          Discard this week
        </button>
      )}
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
          message="All registrations for this week will be removed."
          confirmLabel="Untick all"
          danger
          onCancel={() => setConfirmClear(false)}
          onConfirm={async () => {
            await vm.clearAllRegistrations();
            setConfirmClear(false);
          }}
        />
      )}
      {confirmDiscard && (
        <ConfirmDialog
          title="Discard this week?"
          message="The registrations of this week will be deleted. History is not affected."
          confirmLabel="Discard"
          danger
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={async () => {
            await vm.discardEvent();
            setConfirmDiscard(false);
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
  const lineup = vm.board.core.length + vm.board.rotation.length + vm.board.substitute.length;
  const { lateAdds, withdrawn } = vm.drift;

  return (
    <div className="step">
      <div className="notice notice--info">
        {lineup} in the lineup · {vm.board.notSelected.length} not selected. {vm.editable ? 'Tap a player to move or swap them.' : 'Attendance has started, so the lineup is frozen.'}
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
      <SlotBoard
        board={vm.board}
        capacity={{ core: vm.settings.coreStarters, rotation: vm.settings.rotationStarters, substitute: vm.settings.substitutes }}
        onSelectPlayer={vm.editable ? setSelected : undefined}
        selectedId={selected}
      />
      <div className="sticky-actions sticky-actions--row">
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
  return (
    <div className="step">
      <div className="card">
        <h3 className="card__title">Plan to publish</h3>
        <pre className="plan-text">{vm.planText}</pre>
        <button type="button" className="button button--block" onClick={() => void vm.copyPlan()}>
          Copy plan text
        </button>
      </div>
      {locked ? (
        <div className="sticky-actions">
          <button type="button" className="button button--primary button--block" onClick={() => vm.setStep(4)}>
            Go to attendance
          </button>
        </div>
      ) : (
        <>
          <p className="muted small">
            The poll and the lineup stay editable until the event. Attendance opens on {event ? formatEventDate(event.date) : 'the event day'}; any R4 can start it.
          </p>
          <div className="sticky-actions">
            <button type="button" className="button button--primary button--block" disabled={!vm.eventOver} onClick={() => void vm.startAttendance()}>
              {vm.eventOver ? 'Event finished – record attendance' : `Attendance opens ${event ? formatEventDate(event.date) : ''}`}
            </button>
            {!vm.eventOver && (
              <button type="button" className="button button--ghost button--small" onClick={() => setConfirmEarly(true)}>
                Event already played? Open attendance anyway
              </button>
            )}
          </div>
        </>
      )}
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
      <div className="notice notice--info">
        <span>Lineup is frozen while attendance is recorded.</span>
        <button type="button" className="button button--small" onClick={() => void vm.unlockPlan()}>
          Back to planning
        </button>
      </div>
      <ScreenshotUploader
        title="4. Participation screenshot"
        hint="After the event, screenshot the Team A participant list. Players found are marked as entered."
        imageUrl={ocr.imageUrl}
        status={ocr.status}
        progressLabel={ocr.progressLabel}
        progress={ocr.progress}
        message={ocr.message}
        onFile={(f) => void ocr.run(f)}
        onTrySample={() => void vm.tryAttendanceSample()}
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
      <div className="notice notice--info">
        Starters present: {s.startersPresent}/{s.starters} · substitutes used: {s.subsUsed}
      </div>
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
      <div className="sticky-actions">
        <button type="button" className="button button--primary button--block" onClick={() => setConfirm(true)}>
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
