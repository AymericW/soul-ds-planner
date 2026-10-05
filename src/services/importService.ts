import { parseCsv } from '@/helpers/csv';
import type { RosterImportParseResult } from '@/models/RosterImport';
import { parseRosterTable } from './rosterTableParser';

export class UnsupportedFileError extends Error {}

export interface ImportService {
  /** Reads a .csv/.tsv/.txt or .xlsx/.xls file and parses the roster table. */
  readRosterFile(file: File): Promise<RosterImportParseResult>;
}

const isSpreadsheet = (file: File) => /\.(xlsx|xlsm|xls|ods)$/i.test(file.name);
const isText = (file: File) => /\.(csv|tsv|txt)$/i.test(file.name) || file.type.startsWith('text/');

/** Reads spreadsheet files with SheetJS, loaded only when needed (keeps the app bundle small). */
async function readSpreadsheetTable(file: File): Promise<unknown[][]> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[firstSheet]!, { header: 1, defval: '', raw: false });
}

export function createImportService(): ImportService {
  return {
    async readRosterFile(file) {
      if (isSpreadsheet(file)) return parseRosterTable(await readSpreadsheetTable(file));
      if (isText(file)) return parseRosterTable(parseCsv(await file.text()));
      throw new UnsupportedFileError('Please choose a .csv or .xlsx file.');
    },
  };
}
