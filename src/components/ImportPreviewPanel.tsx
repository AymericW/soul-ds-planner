import { t } from '@/helpers/i18n';
import { formatPower } from '@/helpers/format';
import type { RosterImportParseResult, RosterImportPlan } from '@/models/RosterImport';

interface ImportPreviewPanelProps {
  fileName: string;
  parse: RosterImportParseResult;
  plan: RosterImportPlan;
}

/** What a roster import will do, shown before anything is saved. */
export function ImportPreviewPanel({ fileName, parse, plan }: ImportPreviewPanelProps) {
  const columns = Object.entries(parse.columnMap);
  const m = t().importPreview;
  return (
    <div className="import-preview">
      <p className="muted small">
        {m.file} <strong>{fileName}</strong>
        {columns.length > 0 && (
          <>
            {' '}
            · {m.columns} {columns.map(([field, header]) => `${field} ← “${header}”`).join(', ')}
          </>
        )}
      </p>
      <div className="summary-grid">
        <div className="summary-tile summary-tile--good">
          <strong>{plan.toAdd.length}</strong> {m.new}
        </div>
        <div className="summary-tile summary-tile--info">
          <strong>{plan.toUpdate.length}</strong> {m.updated}
        </div>
        <div className="summary-tile">
          <strong>{plan.unchanged.length}</strong> {m.unchanged}
        </div>
        <div className="summary-tile summary-tile--warn">
          <strong>{plan.skipped.length}</strong> {m.skipped}
        </div>
      </div>
      {plan.toAdd.length > 0 && (
        <details open>
          <summary>{m.newMembers(plan.toAdd.length)}</summary>
          <ul className="plain-list">
            {plan.toAdd.map((r) => (
              <li key={r.rowNumber}>
                {r.name} · {r.power !== undefined ? formatPower(r.power) : m.noPower} · {m.activity(r.activity ?? 3)}
                {r.rank ? ` · ${r.rank}` : ''}
                {r.active === false ? m.inactive : ''}
              </li>
            ))}
          </ul>
        </details>
      )}
      {plan.toUpdate.length > 0 && (
        <details open>
          <summary>{m.updates(plan.toUpdate.length)}</summary>
          <ul className="plain-list">
            {plan.toUpdate.map((u) => (
              <li key={u.memberId}>
                <strong>{u.existingName}</strong>: {u.changes.join(', ')}
              </li>
            ))}
          </ul>
        </details>
      )}
      {plan.skipped.length > 0 && (
        <details open>
          <summary>{m.skippedRows(plan.skipped.length)}</summary>
          <ul className="plain-list plain-list--warn">
            {plan.skipped.map((s, i) => (
              <li key={`${s.rowNumber}-${i}`}>
                {m.row(s.rowNumber, s.message)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
