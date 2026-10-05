import type { Member } from '@/models/Member';
import type { Registration } from '@/models/Registration';
import type { Suspension } from '@/models/Suspension';
import { remainingSuspension } from '@/domain/penalties/suspensions';
import { pluralise } from '@/helpers/format';

export interface IneligibleApplicant {
  memberId: string;
  reason: string;
}

export interface EligibilitySplit {
  eligible: Member[];
  ineligible: IneligibleApplicant[];
}

/** Only active, non-suspended members who registered can be selected. Unknown ids are ignored. */
export function splitEligibility(
  registrations: readonly Registration[],
  members: readonly Member[],
  suspensions: readonly Suspension[],
): EligibilitySplit {
  const byId = new Map(members.map((m) => [m.id, m]));
  const seen = new Set<string>();
  const eligible: Member[] = [];
  const ineligible: IneligibleApplicant[] = [];
  for (const reg of registrations) {
    if (seen.has(reg.memberId)) continue;
    seen.add(reg.memberId);
    const member = byId.get(reg.memberId);
    if (!member) continue;
    const suspended = remainingSuspension(member.id, suspensions);
    if (!member.active) ineligible.push({ memberId: member.id, reason: 'Inactive member – not eligible.' });
    else if (suspended > 0) {
      ineligible.push({ memberId: member.id, reason: `Suspended – ${pluralise(suspended, 'event')} left (no-show without notice).` });
    } else eligible.push(member);
  }
  return { eligible, ineligible };
}
