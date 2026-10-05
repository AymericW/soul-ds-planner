import { formatEventDate } from '@/helpers/dates';
import type { Member } from '@/models/Member';
import type { WeekEvent } from '@/models/WeekEvent';
import { assignmentsBySlot } from './overrides';

/** Plain-text plan ready to paste into the alliance chat. */
export function buildPlanText(event: WeekEvent, members: readonly Member[]): string {
  const names = new Map(members.map((m) => [m.id, m.name]));
  const name = (id: string) => names.get(id) ?? '(removed member)';
  const slots = assignmentsBySlot(event.assignments);
  const lines = [`SOUL – Desert Storm Team A – ${formatEventDate(event.date)}`, ''];
  lines.push(`CORE (${slots.core.length}): ${slots.core.map((a) => name(a.memberId)).join(', ') || '–'}`);
  lines.push(`ROTATION (${slots.rotation.length}): ${slots.rotation.map((a) => name(a.memberId)).join(', ') || '–'}`);
  lines.push(
    `SUBSTITUTES (${slots.substitute.length}, in call-in order): ${
      slots.substitute.map((a, i) => `${i + 1}. ${name(a.memberId)}`).join(', ') || '–'
    }`,
  );
  lines.push('', 'Starters: if you cannot join, tell an R4 or arrange a substitute – no-shows without notice are suspended.');
  return lines.join('\n');
}
