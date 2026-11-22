import { t } from '@/helpers/i18n';
import { formatWeeksAgo, formatPercent, formatPower } from '@/helpers/format';
import type { Member } from '@/models/Member';
import type { MemberStats } from '@/models/MemberStats';
import { ActivityStars } from './ActivityStars';

interface MemberCardProps {
  member: Member;
  stats: MemberStats;
  onSelect: () => void;
}

/** Roster consultation card: every column of the roster in a touch-friendly block. */
export function MemberCard({ member, stats, onSelect }: MemberCardProps) {
  const m = t().member;
  return (
    <button type="button" className={`member-card${member.active ? '' : ' is-inactive'}`} onClick={onSelect}>
      <div className="member-card__top">
        <span className="member-card__name">{member.name}</span>
        {member.rank && <span className="badge badge--rank">{member.rank}</span>}
        {!member.active && <span className="badge badge--muted">{t().common.inactive}</span>}
        {stats.suspensionRemaining > 0 && (
          <span className="badge badge--danger">{m.suspendedLeft(stats.suspensionRemaining)}</span>
        )}
      </div>
      <dl className="member-card__stats">
        <div>
          <dt>{m.power}</dt>
          <dd>{formatPower(member.power)}</dd>
        </div>
        <div>
          <dt>{m.activity}</dt>
          <dd>
            <ActivityStars value={member.activity} />
          </dd>
        </div>
        <div>
          <dt>{m.participation}</dt>
          <dd>{formatPercent(stats.participationRate)}</dd>
        </div>
        <div>
          <dt>{m.played}</dt>
          <dd>{m.weeksPlayed(stats.weeksPlayed, stats.weeksRegistered)}</dd>
        </div>
        <div className="member-card__wide">
          <dt>{m.lastPlayed}</dt>
          <dd>{formatWeeksAgo(stats.weeksSinceLastPlayed)}</dd>
        </div>
      </dl>
    </button>
  );
}
