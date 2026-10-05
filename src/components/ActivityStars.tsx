import { ACTIVITY_MAX } from '@/constants/rules';

export function ActivityStars({ value }: { value: number }) {
  return (
    <span className="stars" aria-label={`Activity ${value} of ${ACTIVITY_MAX}`} title={`Activity ${value}/${ACTIVITY_MAX}`}>
      {Array.from({ length: ACTIVITY_MAX }, (_, i) => (
        <span key={i} className={i < value ? 'stars__on' : 'stars__off'} aria-hidden="true">
          ★
        </span>
      ))}
    </span>
  );
}
