import { t } from '@/helpers/i18n';
import { useState } from 'react';
import { AttendanceList } from '@/components/AttendanceList';
import { BuildingActionSheet } from '@/components/BuildingActionSheet';
import { BuildingBoard } from '@/components/BuildingBoard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { CameraIcon, ClockIcon, CopyIcon, DownloadIcon, LinkIcon, PlusIcon, ShareIcon } from '@/components/Icons';
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
import { formatPower } from '@/helpers/format';
import { useWeeklyEventViewModel, type WeeklyEventViewModel, type WizardStep } from '@/viewmodels/useWeeklyEventViewModel';

const stepLabel = (step: WizardStep): string =>
  ({ 1: t().week.stepPoll, 2: t().week.stepLineup, 3: t().week.stepShare, 4: t().week.stepAttend })[step];

export function WeeklyEventScreen({ onNavigate }: { onNavigate: (route: RouteId) => void }) {
  const vm = useWeeklyEventViewModel();
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const m = t().week;

  if (vm.loading) return <p className="muted">{t().common.loading}</p>;

  if (!vm.hasMembers) {
    return (
      <section className="screen">
        <h1 className="screen__title">{m.title}</h1>
        <EmptyState title={m.startRoster}>
          <p>{m.startRosterHint}</p>
          <button type="button" className="button button--primary" onClick={() => onNavigate(ROUTES.roster)}>
            {m.openRoster}
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
          <span className="eyebrow">{m.gameName}</span>
          <h1 className="screen__title">{formatEventDate(event.date)}</h1>
        </div>
        <span className={`status-chip status-chip--${event.status}`}>{t().status[event.status]}</span>
      </div>
      {vm.weekOptions.length > 1 && (
        <label className="field">
          <span className="field__label">{m.week}</span>
          <select className="input" value={vm.weekKey ?? ''} onChange={(e) => vm.chooseWeek(e.target.value)}>
            {vm.weekOptions.map((w) => (
              <option key={w.key} value={w.key}>
                {w.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="team-switch" role="tablist" aria-label={m.eventAria}>
        {vm.eventTabs.map((tab) => (
          <button
            key={tab.slot}
            type="button"
            role="tab"
            aria-selected={tab.slot === vm.slot}
            className={`team-switch__item${tab.slot === vm.slot ? ' is-selected' : ''}`}
            onClick={() => (tab.status ? vm.selectSlot(tab.slot) : void vm.startNewWeek(event.date))}
          >
            <span className="team-switch__team">{tab.team}</span>
            <span className="team-switch__meta">
              {tab.status ? `${tab.shortTime} · ${tab.registered}` : m.tapToCreate}
              {tab.status === 'finalised' && m.done}
            </span>
          </button>
        ))}
      </div>
      {finalised ? (
        <div className="notice notice--success">
          <span>{m.finalisedNotice(vm.team)}</span>
          <button type="button" className="button button--small" onClick={() => onNavigate(ROUTES.history)}>
            {t().common.viewHistory}
          </button>
        </div>
      ) : (
        <>
          <StepIndicator
            steps={([1, 2, 3, 4] as WizardStep[]).map((id) => ({ id, label: stepLabel(id), enabled: vm.unlockedSteps[id] }))}
            current={vm.step}
            onSelect={(id) => vm.setStep(id as WizardStep)}
          />
          {vm.step === 1 && <PollStep vm={vm} />}
          {vm.step === 2 && <SelectionStep vm={vm} />}
          {vm.step === 3 && <ShareStep vm={vm} />}
          {vm.step === 4 && <AttendanceStep vm={vm} />}
          <button type="button" className="button button--danger-ghost button--small discard" onClick={() => setConfirmDiscard(true)}>
            {m.discard(vm.team)}
          </button>
        </>
      )}
      {confirmDiscard && (
        <ConfirmDialog
          title={m.discardTitle(vm.team)}
          message={m.discardText(vm.team, formatEventDate(event.date))}
          confirmLabel={m.deleteEvent}
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
  const m = t().week;
  return (
    <section className="screen">
      <h1 className="screen__title">{m.title}</h1>
      {vm.previousSummary && (
        <div className="notice notice--success">
          <div>
            <strong>{m.lastWeekFinalised}</strong>
            {m.lastWeekPlayed(vm.previousSummary.label, t().count.player(vm.previousSummary.played))}
            {vm.previousSummary.suspendedNames.length > 0 ? m.suspendedNames(vm.previousSummary.suspendedNames.join(', ')) : m.noPenalties}
          </div>
          <button type="button" className="button button--small" onClick={() => onNavigate(ROUTES.history)}>
            {t().common.viewHistory}
          </button>
        </div>
      )}
      <div className="card start-card">
        <h2 className="card__title">{m.startTitle}</h2>
        <p className="muted">
          {m.startText(
            vm.eventTabs[0]?.timeLabel ?? '',
            vm.eventTabs[1]?.timeLabel ?? '',
            vm.settings.coreStarters,
            vm.settings.rotationStarters,
            vm.settings.substitutes,
            vm.cap,
          )}
        </p>
        <label className="field">
          <span className="field__label">{m.eventDate}</span>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <button type="button" className="button button--primary button--block" disabled={!date} onClick={() => void vm.startNewWeek(date)}>
          {m.createBoth}
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
  const m = t().week;
  const warningOf = (i: { inactive: boolean; suspendedFor: number }) =>
    i.inactive ? t().common.inactive : i.suspendedFor > 0 ? t().common.suspendedCount(i.suspendedFor) : undefined;

  const runSelection = async (scope: 'this' | 'both') => {
    await vm.runWeeklySelection(scope);
    setConfirmRun(false);
    setConfirmBoth(false);
  };

  return (
    <div className="step">
      {!vm.editable && (
        <div className="notice notice--info">{m.frozenPoll}</div>
      )}
      {registration && (
        <div className={`join-strip${early ? '' : ' is-closed'}`}>
          <ClockIcon size={18} />
          <span className="join-strip__text">
            {early ? (
              <>
                {m.joinOpen}
                <strong>{vm.registrationCloseShort}</strong>
                {m.joinOpenIn(vm.registrationClosesIn)}
              </>
            ) : (
              <>
                {m.registrationClosed}
                <strong>{vm.registrationCloseShort}</strong>
                {m.readyToRun}
              </>
            )}
            {!vm.joinLink && <span className="muted">{m.setJoinCode}</span>}
          </span>
          {vm.joinLink && early && (
            <button type="button" className="button button--ghost button--small" onClick={vm.openJoinPage}>
              {m.signUpMyself}
            </button>
          )}
          {vm.joinLink && (
            <button type="button" className="icon-tile icon-tile--small" aria-label={m.copyJoinLink} onClick={() => void vm.copyJoinLink()}>
              <LinkIcon size={18} />
            </button>
          )}
        </div>
      )}
      {importVisible && (
        <ScreenshotUploader
          title={m.importPoll}
          hint={m.importPollHint}
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
        checkedLabel={m.registered}
        disabled={!vm.editable}
        onSelect={setSheetFor}
        actions={
          <>
            <button
              type="button"
              className={`icon-tile${importVisible ? ' is-active' : ''}`}
              aria-label={m.importPoll}
              aria-pressed={importVisible}
              disabled={!vm.editable}
              onClick={() => setShowImport((v) => !v)}
            >
              <CameraIcon />
            </button>
            <button type="button" className="icon-tile" aria-label={m.addNewMember} disabled={!vm.editable} onClick={() => setAdding(true)}>
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
          warning: warningOf(i),
          badges: [
            ...(i.registered && i.selfRegistered ? [{ label: m.selfRegistered, tone: 'rank' as const }] : []),
            ...(i.otherEventNote ? [{ label: i.otherEventNote, tone: 'muted' as const }] : []),
          ],
          detail:
            i.registered && i.selfRegistered
              ? `${i.submittedAt ? m.sentAt(formatTimestamp(i.submittedAt)) : m.sent}${i.enteredPower !== undefined ? m.entered(formatPower(i.enteredPower)) : ''}${i.powerPending ? m.powerWaiting : ''}`
              : i.powerPending
                ? m.powerWaitingCapital
                : undefined,
          detailWarning: i.powerPending,
        }))}
      />
      <div className="step-extras">
        <details className="hint-details">
          <summary className="muted small">{m.howToFill}</summary>
          <p className="muted small">{m.howToFillText(vm.team)}</p>
        </details>
        <div className="step-extras__actions">
          {vm.canRunBoth && (
            <button type="button" className="button button--ghost button--small" disabled={early} onClick={() => setConfirmRun(true)}>
              {m.runOnly(vm.team)}
            </button>
          )}
          <button
            type="button"
            className="button button--ghost button--small"
            onClick={() => setConfirmClear(true)}
            disabled={!vm.editable || vm.registeredCount === 0}
          >
            {m.untickAll}
          </button>
        </div>
      </div>
      {vm.editable && (
        <div className="action-bar">
          <div className="action-bar__summary">
            <strong>
              {m.registeredCount(vm.registeredCount)}
              {vm.substituteOnlyCount > 0 && <span className="muted">{m.subOnlyCount(vm.substituteOnlyCount)}</span>}
            </strong>
            {registration && early ? (
              <span className="is-warning">{m.waitUntil(vm.registrationCloseShort)}</span>
            ) : (
              <span>{m.placesSummary(vm.cap, vm.starters, vm.settings.substitutes)}</span>
            )}
          </div>
          <button type="button" className="button button--primary" disabled={vm.registeredCount === 0 || early}
            onClick={() => (vm.defaultScope === 'both' ? setConfirmBoth(true) : setConfirmRun(true))}
          >
            {rerun ? m.rerunSelection : m.runSelection}
            {vm.defaultScope === 'both' && ' (A + B)'}
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
            sheetItem.registered ? (sheetItem.selfRegistered ? m.selfRegistered : sheetItem.fromOcr ? m.fromScreenshot : m.tickedByR4) : null,
            sheetItem.submittedAt ? m.sentAt(formatTimestamp(sheetItem.submittedAt)) : null,
            sheetItem.otherEventNote ?? null,
          ]
            .filter(Boolean)
            .join(' · ')}
          warning={warningOf(sheetItem)}
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
        <Modal title={m.powerOf(editingItem.name)} onClose={() => setEditingPower(null)}>
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
      {confirmRun && !early && (
          <ConfirmDialog
            title={rerun ? m.rerunTitle(vm.team) : m.runTitle(vm.team)}
            message={
              <>
                <p>{rerun ? m.rerunText : m.runText(t().count.registeredPlayer(vm.registeredCount), vm.team)}</p>
                {!rerun && <p className="muted small">{m.closedOn(vm.registrationCloseLabel)}</p>}
              </>
            }
            confirmLabel={rerun ? m.rerunSelection : m.runSelection}
            onCancel={() => setConfirmRun(false)}
            onConfirm={() => runSelection('this')}
          />
        )}
      {confirmBoth && !early && (
          <ConfirmDialog
            title={m.bothTitle}
            message={m.bothText}
            confirmLabel={m.runBoth}
            onCancel={() => setConfirmBoth(false)}
            onConfirm={() => runSelection('both')}
          />
        )}
      {adding && (
        <Modal title={m.addNewMember} onClose={() => setAdding(false)}>
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
          title={m.untickTitle}
          message={m.untickText(vm.team)}
          confirmLabel={m.untickAll}
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
  const m = t().week;
  const stats = [
    { slot: 'core', label: t().slots.core, count: vm.board.core.length, cap: vm.settings.coreStarters },
    { slot: 'rotation', label: t().slots.rotation, count: vm.board.rotation.length, cap: vm.settings.rotationStarters },
    { slot: 'substitute', label: t().slots.subsShort, count: vm.board.substitute.length, cap: vm.settings.substitutes },
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
          <span>{m.driftNotice(lateAdds.length, withdrawn.length)}</span>
          <button type="button" className="button button--small" onClick={() => void vm.keepPlanWithLateChanges()}>
            {m.keepPlan}
          </button>
          <button type="button" className="button button--small" disabled={vm.registrationStillOpen} onClick={() => setConfirmRerun(true)}>
            {m.rerunSelection}
          </button>
        </div>
      )}
      <p className="muted small step-hint">
        {vm.editable ? m.tapToMove : m.frozen}
        {vm.board.notSelected.length > 0 && m.notSelectedCount(vm.board.notSelected.length)}
        {m.neverBoth}
      </p>
      <SlotBoard
        board={vm.board}
        capacity={{ core: vm.settings.coreStarters, rotation: vm.settings.rotationStarters, substitute: vm.settings.substitutes }}
        onSelectPlayer={vm.editable ? setSelected : undefined}
        selectedId={selected}
      />
      <div className="action-bar action-bar--row">
        {vm.editable && (
          <button
            type="button"
            className="button"
            disabled={vm.registrationStillOpen}
            onClick={() => (vm.weekHasOverrides ? setConfirmRerun(true) : void vm.runWeeklySelection(vm.defaultScope))}
          >
            {vm.defaultScope === 'both' ? m.rerunBoth : m.rerun}
          </button>
        )}
        <button type="button" className="button button--primary" onClick={() => vm.setStep(3)}>
          {m.nextShare}
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
          title={vm.defaultScope === 'both' ? m.rerunBothTitle : m.rerunSelectionTitle}
          message={vm.defaultScope === 'both' ? m.rerunBothText : m.rerunText}
          confirmLabel={m.rerun}
          onCancel={() => setConfirmRerun(false)}
          onConfirm={async () => {
            await vm.runWeeklySelection(vm.defaultScope);
            setConfirmRerun(false);
          }}
        />
      )}
    </div>
  );
}

function ShareStep({ vm }: { vm: WeeklyEventViewModel }) {
  const [confirmResetBuildings, setConfirmResetBuildings] = useState(false);
  const event = vm.event;
  const locked = event?.status === 'locked';
  const lineup = vm.board.core.length + vm.board.rotation.length + vm.board.substitute.length;
  const m = t().week;
  return (
    <div className="step">
      <div className="section-head">
        <h2 className="section-head__title">{m.signupList}</h2>
        <span className="muted small">{t().count.player(lineup)}</span>
      </div>
      <SignupList
        board={vm.board}
        capacity={{ core: vm.settings.coreStarters, rotation: vm.settings.rotationStarters, substitute: vm.settings.substitutes }}
      />
      <details className="hint-details">
        <summary className="muted small">{m.planText}</summary>
        <pre className="plan-text">{vm.planText}</pre>
      </details>
      <BuildingsSection vm={vm} onReset={() => setConfirmResetBuildings(true)} />
      {confirmResetBuildings && (
        <ConfirmDialog
          title={m.refillTitle}
          message={m.refillText}
          confirmLabel={m.refill}
          onCancel={() => setConfirmResetBuildings(false)}
          onConfirm={async () => {
            await vm.resetBuildings();
            setConfirmResetBuildings(false);
          }}
        />
      )}
      <div className="action-bar action-bar--row">
        <button type="button" className="button" onClick={() => void vm.copyPlan()}>
          <CopyIcon size={18} /> {m.copyPlan}
        </button>
        {locked ? (
          <button type="button" className="button button--primary" onClick={() => vm.setStep(4)}>
            {m.goToAttendance}
          </button>
        ) : (
          <button type="button" className="button button--primary" disabled={!vm.eventOver} onClick={() => void vm.startAttendance()}>
            {vm.eventOver ? m.recordAttendance : m.attendanceFrom(vm.eventEndShort)}
          </button>
        )}
      </div>
    </div>
  );
}

/** The building assignments (tap to move or swap) and the picture for the game chat. */
function BuildingsSection({ vm, onReset }: { vm: WeeklyEventViewModel; onReset: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const board = vm.buildingBoard;
  const placed = board.buildings.flatMap((b) => b.players.map((p) => ({ ...p, building: b.id, buildingLabel: b.label })));
  const m = t().week;
  const unplaced = board.unplaced.map((p) => ({ ...p, building: null, buildingLabel: m.notPlaced }));
  const all = [...placed, ...unplaced];
  const player = selected ? all.find((p) => p.memberId === selected) : undefined;
  const filled = placed.length;
  const places = board.buildings.reduce((n, b) => n + b.capacity, 0);
  return (
    <>
      <div className="section-head">
        <h2 className="section-head__title">{m.buildings}</h2>
        <span className="muted small">{m.placed(filled, places)}</span>
      </div>
      <p className="muted small step-hint">
        {vm.buildingsEditable ? m.buildingsHint : m.buildingsFinal}
      </p>
      <BuildingBoard board={board} onSelectPlayer={vm.buildingsEditable ? setSelected : undefined} selectedId={selected} />
      {vm.hasBuildingMoves && vm.buildingsEditable && (
        <div className="step-extras__actions">
          <button type="button" className="button button--ghost button--small" onClick={onReset}>
            {m.refillFromPower}
          </button>
        </div>
      )}
      <div className="section-head">
        <h2 className="section-head__title">{m.imageTitle}</h2>
      </div>
      {vm.buildingImageError ? (
        <div className="notice notice--danger">{vm.buildingImageError}</div>
      ) : vm.buildingImageUrl ? (
        <img className="image-preview" src={vm.buildingImageUrl} alt={m.imageAlt(vm.team)} />
      ) : (
        <p className="muted small">{m.drawing}</p>
      )}
      <div className="step-extras__actions">
        <button type="button" className="button button--small" disabled={!vm.buildingImageUrl} onClick={() => void vm.downloadBuildingImage('this')}>
          <DownloadIcon size={18} /> {m.download}
        </button>
        {vm.otherTeamHasPlan && (
          <button type="button" className="button button--ghost button--small" disabled={!vm.buildingImageUrl} onClick={() => void vm.downloadBuildingImage('both')}>
            {m.downloadBoth}
          </button>
        )}
        {vm.canShareImage && (
          <button type="button" className="button button--ghost button--small" disabled={!vm.buildingImageUrl} onClick={() => void vm.shareBuildingImage('this')}>
            <ShareIcon size={18} /> {m.share}
          </button>
        )}
      </div>
      {player && (
        <BuildingActionSheet
          player={player}
          buildings={vm.buildingTargets}
          others={all}
          onClose={() => setSelected(null)}
          onMove={(to) => {
            void vm.moveToBuilding(player.memberId, to);
            setSelected(null);
          }}
          onSwap={(other) => {
            void vm.swapBuildingPlayers(player.memberId, other);
            setSelected(null);
          }}
        />
      )}
    </>
  );
}

function AttendanceStep({ vm }: { vm: WeeklyEventViewModel }) {
  const [confirm, setConfirm] = useState(false);
  const ocr = vm.attendanceOcr;
  const s = vm.attendanceSummary;
  const m = t().week;
  return (
    <div className="step">
      <div className="join-strip">
        <span className="join-strip__text">{m.frozenAttendance}</span>
        <button type="button" className="button button--small" onClick={() => void vm.unlockPlan()}>
          {m.backToPlanning}
        </button>
      </div>
      <ScreenshotUploader
        title={m.participation}
        hint={m.participationHint(vm.team)}
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
        title={m.notMatched}
        hint={m.notMatchedHint}
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
          ? m.penaltyPreview(vm.penaltyPreview.map((p) => p.name).join(', '), t().count.event(vm.settings.suspensionEvents))
          : m.noPenaltyPreview}
      </div>
      <div className="action-bar">
        <div className="action-bar__summary">
          <strong>{m.startersPresent(s.startersPresent, s.starters)}</strong>
          <span>{m.subsUsed(s.subsUsed)}</span>
        </div>
        <button type="button" className="button button--primary" onClick={() => setConfirm(true)}>
          {m.finaliseEvent}
        </button>
      </div>
      {confirm && (
        <ConfirmDialog
          title={m.finaliseTitle}
          message={
            <>
              <p>{m.finaliseText(vm.penaltyPreview.length > 0)}</p>
              <p className="muted small">{m.finaliseNote}</p>
            </>
          }
          confirmLabel={m.finalise}
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
