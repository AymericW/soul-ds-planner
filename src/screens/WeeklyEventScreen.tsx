import type { RouteId } from '@/constants/routes';

export function WeeklyEventScreen({ onNavigate }: { onNavigate: (route: RouteId) => void }) {
  return (
    <section className="screen">
      <h1 className="screen__title">This week</h1>
      <p className="muted">The weekly wizard arrives in the next phase.</p>
      <button type="button" className="button" onClick={() => onNavigate('roster')}>
        Open roster
      </button>
    </section>
  );
}
