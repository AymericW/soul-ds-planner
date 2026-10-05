import { useCallback, useMemo, useState } from 'react';
import { UI_STORAGE_KEYS } from '@/constants/storageKeys';
import { DEMO_ROSTER } from '@/data/demo/demoRoster';
import { computeRosterStats } from '@/domain/history/memberStats';
import { liftSuspensions } from '@/domain/penalties/suspensions';
import { applyRosterImportPlan, planRosterImport } from '@/domain/roster/importPlan';
import {
  createMember,
  removeAlias as removeAliasRule,
  updateMember,
  validateMemberDraft,
  type MemberDraftErrors,
} from '@/domain/roster/memberRules';
import { toIsoDate } from '@/helpers/dates';
import { normaliseName } from '@/helpers/normalise';
import type { Member, MemberDraft } from '@/models/Member';
import type { MemberStats } from '@/models/MemberStats';
import type { RosterImportParseResult, RosterImportPlan } from '@/models/RosterImport';
import { downloadTextFile, rosterToCsv } from '@/services/exportService';
import { useAppServices } from './AppServicesContext';
import { useAppData } from './useAppData';
import { useToasts } from './ToastContext';

export type RosterSort = 'name' | 'power' | 'activity' | 'participation' | 'lastPlayed';
export type RosterFilter = 'all' | 'active' | 'inactive' | 'suspended';

export interface RosterRow {
  member: Member;
  stats: MemberStats;
}

export interface ImportPreview {
  fileName: string;
  parse: RosterImportParseResult;
  plan: RosterImportPlan;
}

function readSort(): RosterSort {
  try {
    const v = localStorage.getItem(UI_STORAGE_KEYS.rosterSort);
    return v === 'power' || v === 'activity' || v === 'participation' || v === 'lastPlayed' ? v : 'name';
  } catch {
    return 'name';
  }
}

const EMPTY_STATS = (memberId: string): MemberStats => ({
  memberId,
  eventsRegistered: 0,
  timesPlayed: 0,
  participationRate: null,
  eventsSinceLastPlayed: null,
  suspensionRemaining: 0,
});

export function useRosterViewModel() {
  const { repos, importer, now, newId } = useAppServices();
  const { notify } = useToasts();
  const data = useAppData();
  const { members, events, suspensions, reload } = data;

  const [search, setSearch] = useState('');
  const [sort, setSortState] = useState<RosterSort>(readSort);
  const [filter, setFilter] = useState<RosterFilter>('all');
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);

  const setSort = useCallback((next: RosterSort) => {
    setSortState(next);
    try {
      localStorage.setItem(UI_STORAGE_KEYS.rosterSort, next);
    } catch {
      /* preference only */
    }
  }, []);

  const stats = useMemo(() => computeRosterStats(members, events, suspensions), [members, events, suspensions]);

  const rows = useMemo<RosterRow[]>(() => {
    const query = normaliseName(search);
    const list = members
      .map((member) => ({ member, stats: stats.get(member.id) ?? EMPTY_STATS(member.id) }))
      .filter(({ member, stats: s }) => {
        if (filter === 'active' && !member.active) return false;
        if (filter === 'inactive' && member.active) return false;
        if (filter === 'suspended' && s.suspensionRemaining === 0) return false;
        if (!query) return true;
        return normaliseName(member.name).includes(query) || member.aliases.some((a) => a.includes(query));
      });
    const byName = (a: RosterRow, b: RosterRow) => a.member.name.localeCompare(b.member.name, 'en', { sensitivity: 'base' });
    const sorters: Record<RosterSort, (a: RosterRow, b: RosterRow) => number> = {
      name: byName,
      power: (a, b) => b.member.power - a.member.power || byName(a, b),
      activity: (a, b) => b.member.activity - a.member.activity || byName(a, b),
      participation: (a, b) => (b.stats.participationRate ?? -1) - (a.stats.participationRate ?? -1) || byName(a, b),
      lastPlayed: (a, b) =>
        (b.stats.eventsSinceLastPlayed ?? Infinity) - (a.stats.eventsSinceLastPlayed ?? Infinity) || byName(a, b),
    };
    return list.sort(sorters[sort]);
  }, [members, stats, search, filter, sort]);

  const counts = useMemo(
    () => ({
      total: members.length,
      active: members.filter((m) => m.active).length,
      suspended: [...stats.values()].filter((s) => s.suspensionRemaining > 0).length,
    }),
    [members, stats],
  );

  const validate = useCallback(
    (draft: MemberDraft, editingId?: string): MemberDraftErrors => validateMemberDraft(draft, members, editingId),
    [members],
  );

  /** Returns validation errors (empty object = saved). */
  const saveMember = useCallback(
    async (draft: MemberDraft, editingId?: string): Promise<MemberDraftErrors> => {
      const errors = validateMemberDraft(draft, members, editingId);
      if (Object.keys(errors).length) return errors;
      const nowIso = now().toISOString();
      const existing = editingId ? members.find((m) => m.id === editingId) : undefined;
      const member = existing ? updateMember(existing, draft, nowIso) : createMember(draft, newId(), nowIso);
      await repos.members.save(member);
      await reload();
      notify(existing ? `${member.name} updated.` : `${member.name} added to the roster.`, 'success');
      return {};
    },
    [members, now, newId, repos, reload, notify],
  );

  const deleteMember = useCallback(
    async (id: string) => {
      const member = members.find((m) => m.id === id);
      await repos.members.delete(id);
      await reload();
      if (member) notify(`${member.name} removed. Past events keep their records.`, 'info');
    },
    [members, repos, reload, notify],
  );

  const liftSuspension = useCallback(
    async (memberId: string) => {
      await repos.suspensions.saveMany(liftSuspensions(memberId, suspensions, now().toISOString()));
      await reload();
      notify('Suspension lifted.', 'success');
    },
    [suspensions, repos, now, reload, notify],
  );

  const removeAlias = useCallback(
    async (memberId: string, alias: string) => {
      const member = members.find((m) => m.id === memberId);
      if (!member) return;
      await repos.members.save(removeAliasRule(member, alias, now().toISOString()));
      await reload();
    },
    [members, repos, now, reload],
  );

  const startImport = useCallback(
    async (file: File) => {
      setBusy(true);
      try {
        const parse = await importer.readRosterFile(file);
        const plan = planRosterImport(members, parse.rows, parse.issues);
        setImportPreview({ fileName: file.name, parse, plan });
      } catch (e) {
        notify(e instanceof Error ? `Import failed: ${e.message}` : 'Import failed.', 'error');
      } finally {
        setBusy(false);
      }
    },
    [importer, members, notify],
  );

  const commitImport = useCallback(async () => {
    if (!importPreview) return;
    setBusy(true);
    try {
      const { plan } = importPreview;
      const changed = applyRosterImportPlan(plan, members, now().toISOString(), newId);
      await repos.members.saveMany(changed);
      await reload();
      notify(
        `Import done: ${plan.toAdd.length} added, ${plan.toUpdate.length} updated, ${plan.unchanged.length} unchanged, ${plan.skipped.length} skipped.`,
        'success',
      );
      setImportPreview(null);
    } finally {
      setBusy(false);
    }
  }, [importPreview, members, now, newId, repos, reload, notify]);

  const cancelImport = useCallback(() => setImportPreview(null), []);

  const loadDemoRoster = useCallback(async () => {
    const plan = planRosterImport(
      members,
      DEMO_ROSTER.map((row, i) => ({ ...row, rowNumber: i + 1 })),
    );
    const changed = applyRosterImportPlan(plan, members, now().toISOString(), newId);
    await repos.members.saveMany(changed);
    await reload();
    notify(`Demo roster loaded: ${plan.toAdd.length} added, ${plan.toUpdate.length} updated.`, 'success');
  }, [members, now, newId, repos, reload, notify]);

  const exportCsv = useCallback(() => {
    const sorted = [...members].sort((a, b) => a.name.localeCompare(b.name));
    downloadTextFile(`soul-roster-${toIsoDate(now())}.csv`, rosterToCsv(sorted, stats), 'text/csv;charset=utf-8');
  }, [members, stats, now]);

  return {
    loading: data.loading,
    error: data.error,
    rows,
    counts,
    search,
    setSearch,
    sort,
    setSort,
    filter,
    setFilter,
    busy,
    validate,
    saveMember,
    deleteMember,
    liftSuspension,
    removeAlias,
    importPreview,
    startImport,
    commitImport,
    cancelImport,
    loadDemoRoster,
    exportCsv,
  };
}

export type RosterViewModel = ReturnType<typeof useRosterViewModel>;
