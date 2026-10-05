import type { Slot } from '@/models/Assignment';
import { Segmented } from './Segmented';

export interface AttendanceRow {
  memberId: string;
  name: string;
  slot: Slot;
  attended: boolean;
  notified: boolean;
  askNotified: boolean;
  willBeSuspended: boolean;
  fromOcr: boolean;
}

interface AttendanceListProps {
  rows: readonly AttendanceRow[];
  suspensionEvents: number;
  disabled?: boolean;
  onToggleAttended: (memberId: string) => void;
  onSetNotified: (memberId: string, notified: boolean) => void;
}

const GROUPS: ReadonlyArray<{ slot: Slot; title: string; note: string }> = [
  { slot: 'core', title: 'Core', note: '' },
  { slot: 'rotation', title: 'Rotation', note: '' },
  { slot: 'substitute', title: 'Substitutes', note: 'Tick only those who were called in and entered. Substitutes are never penalised.' },
];

const YES_NO = [
  { value: 'yes', label: 'Yes, notified' },
  { value: 'no', label: 'No' },
] as const;

/** Post-event checklist: who entered, and whether absent starters warned an R4. */
export function AttendanceList({ rows, suspensionEvents, disabled, onToggleAttended, onSetNotified }: AttendanceListProps) {
  return (
    <div className="attendance">
      {GROUPS.map(({ slot, title, note }) => {
        const group = rows.filter((r) => r.slot === slot);
        if (group.length === 0) return null;
        return (
          <section key={slot} className={`slot slot--${slot}`}>
            <header className="slot__header">
              <h3 className="slot__title">{title}</h3>
              <span className="slot__count">
                {group.filter((r) => r.attended).length}/{group.length} entered
              </span>
            </header>
            {note && <p className="muted small">{note}</p>}
            <ul className="attendance__list">
              {group.map((r) => (
                <li key={r.memberId} className={`attendance__row${r.willBeSuspended ? ' is-penalised' : ''}`}>
                  <label className="attendance__main">
                    <input type="checkbox" checked={r.attended} disabled={disabled} onChange={() => onToggleAttended(r.memberId)} />
                    <span className="attendance__name">{r.name}</span>
                    {r.fromOcr && r.attended && <span className="badge badge--success">OCR</span>}
                    {r.attended ? <span className="badge badge--success">Entered</span> : <span className="badge badge--muted">Absent</span>}
                  </label>
                  {r.askNotified && (
                    <div className="attendance__notify">
                      <span className="small">Told an R4 / arranged a substitute?</span>
                      <Segmented<'yes' | 'no'>
                        label={`Did ${r.name} notify?`}
                        value={r.notified ? 'yes' : 'no'}
                        options={YES_NO}
                        onChange={(v) => !disabled && onSetNotified(r.memberId, v === 'yes')}
                      />
                      {r.willBeSuspended && (
                        <span className="badge badge--danger">
                          Will be suspended for {suspensionEvents} event{suspensionEvents === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
