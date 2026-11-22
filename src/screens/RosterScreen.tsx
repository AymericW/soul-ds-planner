import { t } from '@/helpers/i18n';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { FileButton } from '@/components/FileButton';
import { ImportPreviewPanel } from '@/components/ImportPreviewPanel';
import { MemberCard } from '@/components/MemberCard';
import { MemberForm } from '@/components/MemberForm';
import { Modal } from '@/components/Modal';
import { SearchInput } from '@/components/SearchInput';
import { Segmented } from '@/components/Segmented';
import { useRosterViewModel, type RosterFilter, type RosterSort } from '@/viewmodels/useRosterViewModel';

const sortOptions = (): ReadonlyArray<{ value: RosterSort; label: string }> => [
  { value: 'name', label: t().roster.sortName },
  { value: 'power', label: t().roster.sortPower },
  { value: 'activity', label: t().roster.sortActivity },
  { value: 'participation', label: t().roster.sortParticipation },
  { value: 'lastPlayed', label: t().roster.sortLastPlayed },
];

const filterOptions = (): ReadonlyArray<{ value: RosterFilter; label: string }> => [
  { value: 'all', label: t().roster.filterAll },
  { value: 'active', label: t().roster.filterActive },
  { value: 'inactive', label: t().roster.filterInactive },
  { value: 'suspended', label: t().roster.filterSuspended },
];

type Editing = { mode: 'add' } | { mode: 'edit'; id: string } | null;

export function RosterScreen() {
  const vm = useRosterViewModel();
  const [editing, setEditing] = useState<Editing>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const editingRow = editing?.mode === 'edit' ? vm.rows.find((r) => r.member.id === editing.id) : undefined;
  const deletingRow = confirmDeleteId ? vm.rows.find((r) => r.member.id === confirmDeleteId) : undefined;
  const m = t().roster;

  return (
    <section className="screen">
      <div className="screen__head">
        <h1 className="screen__title">{m.title}</h1>
        <p className="muted small">{m.counts(vm.counts.total, vm.counts.active, vm.counts.suspended)}</p>
      </div>

      <div className="toolbar">
        <button type="button" className="button button--primary" onClick={() => setEditing({ mode: 'add' })}>
          {m.add}
        </button>
        <FileButton accept=".csv,.tsv,.txt,.xlsx,.xls,text/csv" onFile={(f) => void vm.startImport(f)} disabled={vm.busy}>
          {m.import}
        </FileButton>
        <button type="button" className="button" onClick={vm.exportCsv} disabled={vm.counts.total === 0}>
          {m.export}
        </button>
      </div>

      {vm.counts.total === 0 && !vm.loading ? (
        <EmptyState title={m.empty}>
          <p>
            {m.emptyHint}
            {import.meta.env.DEV ? m.emptyDemo : '.'}
          </p>
          {import.meta.env.DEV && (
            <button type="button" className="button button--primary" onClick={() => void vm.loadDemoRoster()}>
              {m.loadDemo}
            </button>
          )}
        </EmptyState>
      ) : (
        <>
          <SearchInput value={vm.search} onChange={vm.setSearch} />
          <div className="filters">
            <Segmented label={m.filter} value={vm.filter} options={filterOptions()} onChange={vm.setFilter} />
            <label className="sort">
              <span className="muted small">{m.sort}</span>
              <select className="input input--compact" value={vm.sort} onChange={(e) => vm.setSort(e.target.value as RosterSort)}>
                {sortOptions().map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="member-grid">
            {vm.rows.map(({ member, stats }) => (
              <MemberCard key={member.id} member={member} stats={stats} onSelect={() => setEditing({ mode: 'edit', id: member.id })} />
            ))}
          </div>
          {vm.rows.length === 0 && <p className="muted">{m.noMatch(vm.search)}</p>}
        </>
      )}

      {editing && (
        <Modal title={editing.mode === 'add' ? m.addTitle : m.editTitle(editingRow?.member.name ?? m.member)} onClose={() => setEditing(null)}>
          <MemberForm
            member={editingRow?.member}
            suspensionRemaining={editingRow?.stats.suspensionRemaining}
            onCancel={() => setEditing(null)}
            onSubmit={async (draft) => {
              const errors = await vm.saveMember(draft, editingRow?.member.id);
              if (Object.keys(errors).length === 0) setEditing(null);
              return errors;
            }}
            onDelete={editingRow ? () => setConfirmDeleteId(editingRow.member.id) : undefined}
            onLiftSuspension={editingRow ? () => void vm.liftSuspension(editingRow.member.id) : undefined}
            onRemoveAlias={editingRow ? (alias) => void vm.removeAlias(editingRow.member.id, alias) : undefined}
          />
        </Modal>
      )}

      {deletingRow && (
        <ConfirmDialog
          title={m.deleteTitle}
          message={
            <p>
              {m.deleteBefore} <strong>{deletingRow.member.name}</strong> {m.deleteAfter}
            </p>
          }
          confirmLabel={t().common.delete}
          danger
          onCancel={() => setConfirmDeleteId(null)}
          onConfirm={async () => {
            await vm.deleteMember(deletingRow.member.id);
            setConfirmDeleteId(null);
            setEditing(null);
          }}
        />
      )}

      {vm.importPreview && (
        <Modal
          title={m.importPreview}
          onClose={vm.cancelImport}
          footer={
            <>
              <button type="button" className="button button--ghost" onClick={vm.cancelImport}>
                {t().common.cancel}
              </button>
              <button
                type="button"
                className="button button--primary"
                disabled={vm.busy || vm.importPreview.plan.toAdd.length + vm.importPreview.plan.toUpdate.length === 0}
                onClick={() => void vm.commitImport()}
              >
                {m.applyImport}
              </button>
            </>
          }
        >
          <ImportPreviewPanel fileName={vm.importPreview.fileName} parse={vm.importPreview.parse} plan={vm.importPreview.plan} />
        </Modal>
      )}
    </section>
  );
}
