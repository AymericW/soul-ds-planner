import { t } from '@/helpers/i18n';
import { formatEventDate } from '@/helpers/dates';
import type { Member } from '@/models/Member';
import type { WeekEvent } from '@/models/WeekEvent';
import { assignmentsBySlot } from './overrides';

/** Plain-text plan ready to paste into the alliance chat. */
export function buildPlanText(event: WeekEvent, members: readonly Member[]): string {
  const names = new Map(members.map((m) => [m.id, m.name]));
  const m = t();
  const name = (id: string) => names.get(id) ?? m.common.removedMember;
  const slots = assignmentsBySlot(event.assignments);
  const lines = [m.rules.planTitle(m.events.team(event.slot), formatEventDate(event.date), m.events.timeLabel(event.slot)), ''];
  lines.push(m.rules.planCore(slots.core.length, slots.core.map((a) => name(a.memberId)).join(', ') || '–'));
  lines.push(m.rules.planRotation(slots.rotation.length, slots.rotation.map((a) => name(a.memberId)).join(', ') || '–'));
  lines.push(
    m.rules.planSubstitutes(slots.substitute.length, slots.substitute.map((a, i) => `${i + 1}. ${name(a.memberId)}`).join(', ') || '–'),
  );
  lines.push('', m.rules.planStarterNote, m.rules.planOneEvent);
  return lines.join('\n');
}
