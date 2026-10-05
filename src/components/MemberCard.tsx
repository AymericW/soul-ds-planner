import { formatEventsAgo, formatPercent, formatPower } from '@/helpers/format';
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
  return (
    <button type="button" className={`member-card${member.active ? '' : ' is-inactive'}`} onClick={onSelect}>
      <div className="member-card__top">
        <span className="member-card__name">{member.name}</span>
        {member.rank && <span className="badge badge--rank">{member.rank}</span>}
        {!member.active && <span className="badge badge--muted">Inactive</span>}
        {stats.suspensionRemaining > 0 && (
          <span className="badge badge--danger">Suspended · {stats.suspensionRemaining} left</span>
        )}
      </div>
      <dl className="member-card__stats">
        <div>
          <dt>Power</dt>
          <dd>{formatPower(member.power)}</dd>
        </div>
        <div>
          <dt>Activity</dt>
          <dd>
            <ActivityStars value={member.activity} />
          </dd>
        </div>
        <div>
          <dt>Participation</dt>
          <dd>{formatPercent(stats.participationRate)}</dd>
        </div>
        <div>
          <dt>Played</dt>
          <dd>
            {stats.timesPlayed}/{stats.eventsRegistered}
          </dd>
        </div>
        <div className="member-card__wide">
          <dt>Last played</dt>
          <dd>{formatEventsAgo(stats.eventsSinceLastPlayed)}</dd>
        </div>
      </dl>
    </button>
  );
}
