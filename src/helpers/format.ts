/** 152300000 -> "152.3M", 950000 -> "950K", 1.2e9 -> "1.20B". */
export function formatPower(power: number): string {
  if (!Number.isFinite(power) || power <= 0) return '0';
  if (power >= 1e9) return `${(power / 1e9).toFixed(2)}B`;
  if (power >= 1e6) return `${(power / 1e6).toFixed(1)}M`;
  if (power >= 1e3) return `${Math.round(power / 1e3)}K`;
  return String(Math.round(power));
}

/**
 * Parses power written the way players write it:
 * "152.3M", "152,3 M", "1.2B", "950k", "152 300 000", "152,300,000".
 * Plain numbers below 100 000 are interpreted as millions ("152.3" -> 152.3M),
 * because rosters are usually kept in millions. Returns undefined when unparseable.
 */
export function parsePower(input: unknown): number | undefined {
  if (typeof input === 'number') return Number.isFinite(input) && input >= 0 ? scaleBare(input) : undefined;
  if (typeof input !== 'string') return undefined;
  const raw = input.trim().toLowerCase().replace(/\s+/g, '');
  if (!raw) return undefined;
  const m = raw.match(/^([0-9.,]+)([kmb])?$/);
  if (!m) return undefined;
  let numeric = m[1]!;
  const suffix = m[2];
  const commas = (numeric.match(/,/g) ?? []).length;
  const dots = (numeric.match(/\./g) ?? []).length;
  if (commas && dots) numeric = numeric.replace(/,/g, ''); // 1,234.5
  else if (commas === 1 && /,\d{1,2}$/.test(numeric)) numeric = numeric.replace(',', '.'); // 152,3 (decimal comma)
  else if (commas) numeric = numeric.replace(/,/g, ''); // 152,300,000
  else if (dots > 1) numeric = numeric.replace(/\./g, ''); // 152.300.000
  const value = Number(numeric);
  if (!Number.isFinite(value)) return undefined;
  const mult = suffix === 'k' ? 1e3 : suffix === 'm' ? 1e6 : suffix === 'b' ? 1e9 : 0;
  return mult ? Math.round(value * mult) : scaleBare(value);
}

function scaleBare(value: number): number {
  return value < 100_000 ? Math.round(value * 1e6) : Math.round(value);
}

export function formatPercent(ratio: number | null | undefined, digits = 0): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return '–';
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** "0 events ago" reads badly; 0 => "last event". */
export function formatEventsAgo(eventsAgo: number | null): string {
  if (eventsAgo === null) return 'never';
  if (eventsAgo === 0) return 'last event';
  return `${pluralise(eventsAgo, 'event')} ago`;
}
