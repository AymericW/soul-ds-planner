import { ACTIVITY_MAX, ACTIVITY_MIN } from '@/constants/rules';
import { parsePower } from '@/helpers/format';
import { cleanDisplayName, normaliseHeader } from '@/helpers/normalise';
import { MEMBER_RANKS, type MemberRank } from '@/models/Member';
import type { RosterImportIssue, RosterImportParseResult, RosterImportRow } from '@/models/RosterImport';

type Field = 'name' | 'power' | 'activity' | 'rank' | 'active';

/** Accepted header spellings (normalised: lower-case, letters+digits only). */
const HEADER_SYNONYMS: Record<Field, string[]> = {
  name: ['name', 'member', 'membername', 'player', 'playername', 'nickname', 'nick', 'pseudo', 'ign', 'commander', 'username'],
  power: ['power', 'totalpower', 'pow', 'might', 'puissance', 'cp', 'combatpower', 'powerm', 'powermillions', 'heropower'],
  activity: ['activity', 'activityrating', 'activityscore', 'rating', 'act', 'activite', 'activitylevel', 'activity15'],
  rank: ['rank', 'role', 'rang', 'alliancerank', 'r'],
  active: ['active', 'isactive', 'status', 'enabled', 'inalliance', 'actif'],
};

function matchField(header: string): Field | undefined {
  const key = normaliseHeader(header);
  if (!key) return undefined;
  for (const field of Object.keys(HEADER_SYNONYMS) as Field[]) {
    if (HEADER_SYNONYMS[field].includes(key)) return field;
  }
  // looser prefix rules: "Power (M)", "Activity rating 1-5", "Player Name"
  if (key.startsWith('power') || key.endsWith('power')) return 'power';
  if (key.startsWith('activ')) return 'activity';
  if (key.endsWith('name') || key.startsWith('name')) return 'name';
  if (key.startsWith('rank')) return 'rank';
  return undefined;
}

function cellText(cell: unknown): string {
  if (cell === null || cell === undefined) return '';
  return String(cell).trim();
}

export function parseRank(raw: string): MemberRank | undefined {
  const m = raw.trim().toUpperCase().match(/^R?([1-5])$/);
  return m ? (`R${m[1]}` as MemberRank) : MEMBER_RANKS.find((r) => r === raw.trim().toUpperCase());
}

export function parseActiveFlag(raw: string): boolean | undefined {
  const v = raw.trim().toLowerCase();
  if (!v) return undefined;
  if (['yes', 'y', 'true', '1', 'active', 'x', 'oui', 'ok'].includes(v)) return true;
  if (['no', 'n', 'false', '0', 'inactive', 'non', 'left', 'away'].includes(v)) return false;
  return undefined;
}

/**
 * Converts a raw table (CSV rows or spreadsheet rows) into roster rows.
 * Header row is detected by looking for a "name"-like column in the first
 * 5 rows; without any header the columns are read as name, power, activity, rank, active.
 */
export function parseRosterTable(table: ReadonlyArray<ReadonlyArray<unknown>>): RosterImportParseResult {
  const issues: RosterImportIssue[] = [];
  const rows: RosterImportRow[] = [];
  let headerIndex = -1;
  let columns: Partial<Record<Field, number>> = {};
  const columnMap: RosterImportParseResult['columnMap'] = {};

  for (let i = 0; i < Math.min(5, table.length); i++) {
    const candidate: Partial<Record<Field, number>> = {};
    table[i]!.forEach((cell, col) => {
      const field = matchField(cellText(cell));
      if (field && candidate[field] === undefined) candidate[field] = col;
    });
    if (candidate.name !== undefined) {
      headerIndex = i;
      columns = candidate;
      for (const [field, col] of Object.entries(candidate) as [Field, number][]) {
        columnMap[field] = cellText(table[i]![col]);
      }
      break;
    }
  }
  if (headerIndex === -1) {
    columns = { name: 0, power: 1, activity: 2, rank: 3, active: 4 };
    columnMap.name = 'column 1 (no header found)';
    columnMap.power = 'column 2';
    columnMap.activity = 'column 3';
  }

  for (let i = headerIndex + 1; i < table.length; i++) {
    const cells = table[i]!;
    const rowNumber = i + 1;
    const get = (field: Field) => (columns[field] === undefined ? '' : cellText(cells[columns[field]!]));
    const name = cleanDisplayName(get('name'));
    if (!name) {
      if (cells.some((c) => cellText(c) !== '')) issues.push({ rowNumber, message: 'Missing name - row skipped.' });
      continue;
    }
    const row: RosterImportRow = { rowNumber, name };

    const powerRaw = get('power');
    if (powerRaw) {
      const power = parsePower(powerRaw);
      if (power === undefined) issues.push({ rowNumber, message: `"${name}": power "${powerRaw}" not understood - kept unchanged.` });
      else row.power = power;
    }
    const activityRaw = get('activity');
    if (activityRaw) {
      const activity = Number(activityRaw.replace(',', '.'));
      if (!Number.isFinite(activity) || activity < ACTIVITY_MIN || activity > ACTIVITY_MAX) {
        issues.push({ rowNumber, message: `"${name}": activity "${activityRaw}" must be ${ACTIVITY_MIN}-${ACTIVITY_MAX} - kept unchanged.` });
      } else row.activity = Math.round(activity);
    }
    const rankRaw = get('rank');
    if (rankRaw) {
      const rank = parseRank(rankRaw);
      if (rank) row.rank = rank;
      else issues.push({ rowNumber, message: `"${name}": rank "${rankRaw}" ignored (use R1-R5).` });
    }
    const activeRaw = get('active');
    if (activeRaw) {
      const active = parseActiveFlag(activeRaw);
      if (active === undefined) issues.push({ rowNumber, message: `"${name}": active "${activeRaw}" ignored (use yes/no).` });
      else row.active = active;
    }
    rows.push(row);
  }
  return { rows, issues, columnMap };
}
