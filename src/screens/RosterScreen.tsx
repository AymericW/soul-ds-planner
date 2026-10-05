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

const SORT_OPTIONS: ReadonlyArray<{ value: RosterSort; label: string }> = [
  { value: 'name', label: 'Name' },
  { value: 'power', label: 'Power' },
  { value: 'activity', label: 'Activity' },
  { value: 'participation', label: 'Participation' },
  { value: 'lastPlayed', label: 'Longest without playing' },
];

const FILTER_OPTIONS: ReadonlyArray<{ value: RosterFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
];

type Editing = { mode: 'add' } | { mode: 'edit'; id: string } | null;

export function RosterScreen() {
  const vm = useRosterViewModel();
  const [editing, setEditing] = useState<Editing>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const editingRow = editing?.mode === 'edit' ? vm.rows.find((r) => r.member.id === editing.id) : undefined;
  const deletingRow = confirmDeleteId ? vm.rows.find((r) => r.member.id === confirmDeleteId) : undefined;

  return (
    <section className="screen">
      <div className="screen__head">
        <h1 className="screen__title">Roster</h1>
        <p className="muted small">
          {vm.counts.total} members · {vm.counts.active} active · {vm.counts.suspended} suspended
        </p>
      </div>

      <div className="toolbar">
        <button type="button" className="button button--primary" onClick={() => setEditing({ mode: 'add' })}>
          + Add member
        </button>
        <FileButton accept=".csv,.tsv,.txt,.xlsx,.xls,text/csv" onFile={(f) => void vm.startImport(f)} disabled={vm.busy}>
          Import CSV / Excel
        </FileButton>
        <button type="button" className="button" onClick={vm.exportCsv} disabled={vm.counts.total === 0}>
          Export CSV
        </button>
      </div>

      {vm.counts.total === 0 && !vm.loading ? (
        <EmptyState title="No members yet">
          <p>Add members one by one, import your roster spreadsheet (columns: name, power, activity, rank, active) or try the app with a demo roster.</p>
          <button type="button" className="button button--primary" onClick={() => void vm.loadDemoRoster()}>
            Load demo roster
          </button>
        </EmptyState>
      ) : (
        <>
          <SearchInput value={vm.search} onChange={vm.setSearch} />
          <div className="filters">
            <Segmented label="Filter" value={vm.filter} options={FILTER_OPTIONS} onChange={vm.setFilter} />
            <label className="sort">
              <span className="muted small">Sort</span>
              <select className="input input--compact" value={vm.sort} onChange={(e) => vm.setSort(e.target.value as RosterSort)}>
                {SORT_OPTIONS.map((o) => (
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
          {vm.rows.length === 0 && <p className="muted">No member matches “{vm.search}”.</p>}
        </>
      )}

      {editing && (
        <Modal title={editing.mode === 'add' ? 'Add member' : `Edit ${editingRow?.member.name ?? 'member'}`} onClose={() => setEditing(null)}>
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
          title="Delete member?"
          message={
            <p>
              Remove <strong>{deletingRow.member.name}</strong> from the roster? Past events keep their history. To keep the
              member but stop selecting them, mark them inactive instead.
            </p>
          }
          confirmLabel="Delete"
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
          title="Import preview"
          onClose={vm.cancelImport}
          footer={
            <>
              <button type="button" className="button button--ghost" onClick={vm.cancelImport}>
                Cancel
              </button>
              <button
                type="button"
                className="button button--primary"
                disabled={vm.busy || vm.importPreview.plan.toAdd.length + vm.importPreview.plan.toUpdate.length === 0}
                onClick={() => void vm.commitImport()}
              >
                Apply import
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
