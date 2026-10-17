/** Local date as yyyy-mm-dd. */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** "2026-10-05" -> "Mon 5 Oct 2026" (English, independent of device locale). */
export function formatEventDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  const date = new Date(y, m - 1, d);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[date.getDay()]} ${d} ${months[m - 1]} ${y}`;
}

/** "Desert Storm Team A – Fri 16 Oct 2026" (the database builds the same label in ensure_week_events). */
export function defaultEventLabel(isoDate: string, team: string): string {
  return `Desert Storm ${team} – ${formatEventDate(isoDate)}`;
}

export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${formatEventDate(toIsoDate(date))} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Calendar date (yyyy-mm-dd) of `now` in the given IANA time zone, independent of the device zone. */
export function dateInTimeZone(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Wall-clock time of `now` in the given IANA time zone as "yyyy-mm-ddThh:mm" (sortable as a string). */
export function dateTimeInTimeZone(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/** The instant at which the wall clock in `timeZone` shows `hour`:00 on `isoDate`. */
export function zonedTimeToUtc(isoDate: string, hour: number, timeZone: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  const guess = Date.UTC(y!, m! - 1, d!, hour);
  const wall = dateTimeInTimeZone(new Date(guess), timeZone);
  const [wy, wm, wd] = wall.slice(0, 10).split('-').map(Number);
  const [wh, wmin] = wall.slice(11).split(':').map(Number);
  const offset = Date.UTC(wy!, wm! - 1, wd!, wh!, wmin!) - guess;
  return new Date(guess - offset);
}

/** UTC-safe date arithmetic on yyyy-mm-dd strings. */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d! + days));
  return date.toISOString().slice(0, 10);
}

/** ISO weekday of a yyyy-mm-dd date: 1 = Monday … 7 = Sunday. */
export function isoWeekday(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  const day = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
  return day === 0 ? 7 : day;
}

/** The given date if it already is `weekday` (ISO), otherwise the next such day. */
export function nextWeekdayOnOrAfter(isoDate: string, weekday: number): string {
  return addDays(isoDate, (weekday - isoWeekday(isoDate) + 7) % 7);
}

/** Monday of the (Monday-to-Sunday) week containing the date: identifies "the week". */
export function weekStart(isoDate: string): string {
  return addDays(isoDate, 1 - isoWeekday(isoDate));
}
