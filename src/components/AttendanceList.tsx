import { t } from '@/helpers/i18n';
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

const GROUP_SLOTS = ['core', 'rotation', 'substitute'] as const satisfies readonly Slot[];

/** Post-event checklist: who entered, and whether absent starters warned an R4. */
export function AttendanceList({ rows, suspensionEvents, disabled, onToggleAttended, onSetNotified }: AttendanceListProps) {
  const m = t();
  const yesNo = [
    { value: 'yes', label: m.week.yesNotified },
    { value: 'no', label: m.week.no },
  ] as const;
  return (
    <div className="attendance">
      {GROUP_SLOTS.map((slot) => {
        const title = m.slots[slot];
        const note = slot === 'substitute' ? m.week.subsNote : '';
        const group = rows.filter((r) => r.slot === slot);
        if (group.length === 0) return null;
        return (
          <section key={slot} className={`slot slot--${slot}`}>
            <header className="slot__header">
              <h3 className="slot__title">{title}</h3>
              <span className="slot__count">
                {m.week.enteredCount(group.filter((r) => r.attended).length, group.length)}
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
                    {r.attended ? <span className="badge badge--success">{m.week.enteredBadge}</span> : <span className="badge badge--muted">{m.week.absent}</span>}
                  </label>
                  {r.askNotified && (
                    <div className="attendance__notify">
                      <span className="small">{m.week.toldR4}</span>
                      <Segmented<'yes' | 'no'>
                        label={m.week.didNotify(r.name)}
                        value={r.notified ? 'yes' : 'no'}
                        options={yesNo}
                        onChange={(v) => !disabled && onSetNotified(r.memberId, v === 'yes')}
                      />
                      {r.willBeSuspended && (
                        <span className="badge badge--danger">
                          {m.week.willBeSuspended(m.count.event(suspensionEvents))}
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
