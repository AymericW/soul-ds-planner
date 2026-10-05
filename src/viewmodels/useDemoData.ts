import { useCallback } from 'react';
import { DEMO_ROSTER } from '@/data/demo/demoRoster';
import { applyRosterImportPlan, planRosterImport } from '@/domain/roster/importPlan';
import { useAppServices } from './AppServicesContext';
import { useToasts } from './ToastContext';

/** "Load demo roster": merges the fictional demo members into the roster (existing names are updated). */
export function useDemoData(onLoaded: () => Promise<void> | void) {
  const { repos, now, newId } = useAppServices();
  const { notify } = useToasts();
  return useCallback(async () => {
    const members = await repos.members.list();
    const plan = planRosterImport(
      members,
      DEMO_ROSTER.map((row, i) => ({ ...row, rowNumber: i + 1 })),
    );
    await repos.members.saveMany(applyRosterImportPlan(plan, members, now().toISOString(), newId));
    await onLoaded();
    notify(`Demo roster loaded: ${plan.toAdd.length} added, ${plan.toUpdate.length} updated.`, 'success');
  }, [repos, now, newId, notify, onLoaded]);
}
