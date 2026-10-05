import type { MemberRank } from './Member';

/** One parsed row of a roster spreadsheet. */
export interface RosterImportRow {
  rowNumber: number;
  name: string;
  power?: number;
  activity?: number;
  rank?: MemberRank;
  active?: boolean;
}

export interface RosterImportIssue {
  rowNumber: number;
  message: string;
}

export interface RosterImportParseResult {
  rows: RosterImportRow[];
  issues: RosterImportIssue[];
  /** Which source column was used for each field (for the preview). */
  columnMap: Partial<Record<'name' | 'power' | 'activity' | 'rank' | 'active', string>>;
}

export interface RosterImportPlan {
  toAdd: RosterImportRow[];
  toUpdate: Array<{ memberId: string; existingName: string; row: RosterImportRow; changes: string[] }>;
  unchanged: RosterImportRow[];
  skipped: RosterImportIssue[];
}
