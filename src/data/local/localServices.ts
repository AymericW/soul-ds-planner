import type { AuthService, AuthSession } from '@/data/auth';
import { DEMO_ROSTER } from '@/data/demo/demoRoster';
import { createInMemoryRepositories } from '@/data/memory/InMemoryRepositories';
import type { Repositories } from '@/data/repositories';
import type { Account } from '@/models/Account';
import { applyRosterImportPlan, planRosterImport } from '@/domain/roster/importPlan';
import { createId } from '@/helpers/id';

const LOCAL_ACCOUNT: Account = {
  id: 'local-dev-user',
  email: 'dev@local.test',
  displayName: 'Local dev (R5)',
  role: 'r5',
  createdAt: new Date(0).toISOString(),
};

/** Auth stub for local development: always signed in as an R5, no network. */
export function createLocalAuthService(): AuthService {
  const session: AuthSession = { userId: LOCAL_ACCOUNT.id, email: LOCAL_ACCOUNT.email };
  return {
    getSession: async () => session,
    onChange: () => () => undefined,
    signIn: async () => undefined,
    signOut: async () => undefined,
    changePassword: async () => undefined,
    getOwnAccount: async () => LOCAL_ACCOUNT,
    listAccounts: async () => [LOCAL_ACCOUNT],
    setRole: async () => undefined,
  };
}

/** Join code of the local stub data: open `#/join?code=LOCALDEV` to try the public join page. */
export const LOCAL_JOIN_CODE = 'LOCALDEV';

/**
 * In-memory repositories pre-filled with the fictional demo roster, a join code and this
 * week's Team A / Team B events. Data resets on reload (nothing is persisted locally, so the
 * switch to two events per week needs no local data migration).
 */
export async function createSeededLocalRepositories(now: () => Date = () => new Date()): Promise<Repositories> {
  const repos = createInMemoryRepositories({ now });
  const plan = planRosterImport(
    [],
    DEMO_ROSTER.map((row, i) => ({ ...row, rowNumber: i + 1 })),
  );
  await repos.members.saveMany(applyRosterImportPlan(plan, [], now().toISOString(), createId));
  await repos.settings.setJoinCode(LOCAL_JOIN_CODE);
  await repos.events.ensureWeekEvents();
  return repos;
}
