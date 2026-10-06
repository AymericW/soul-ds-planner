/**
 * pending: signed up but not approved yet · r4: leadership, edits alliance data ·
 * r5: r4 plus account management and data reset/restore · disabled: locked out.
 */
export const ACCOUNT_ROLES = ['pending', 'r4', 'r5', 'disabled'] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

export interface Account {
  id: string;
  email: string;
  displayName: string;
  role: AccountRole;
  createdAt: string;
}
