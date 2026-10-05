import { NAV_ITEMS, type RouteId } from '@/constants/routes';

interface BottomNavProps {
  current: RouteId;
  onNavigate: (route: RouteId) => void;
}

export function BottomNav({ current, onNavigate }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="Main">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`bottom-nav__item${item.id === current ? ' is-active' : ''}`}
          aria-current={item.id === current ? 'page' : undefined}
          onClick={() => onNavigate(item.id)}
        >
          <span className="bottom-nav__icon" aria-hidden="true">
            {item.icon}
          </span>
          <span className="bottom-nav__label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
