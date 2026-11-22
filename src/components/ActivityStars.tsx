import { t } from '@/helpers/i18n';
import { ACTIVITY_MAX } from '@/constants/rules';

export function ActivityStars({ value }: { value: number }) {
  return (
    <span className="stars" aria-label={t().member.activityAria(value, ACTIVITY_MAX)} title={t().member.activityTitle(value, ACTIVITY_MAX)}>
      {Array.from({ length: ACTIVITY_MAX }, (_, i) => (
        <span key={i} className={i < value ? 'stars__on' : 'stars__off'} aria-hidden="true">
          ★
        </span>
      ))}
    </span>
  );
}
