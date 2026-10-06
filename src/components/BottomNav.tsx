import type { ReactNode } from 'react';
import { NAV_ITEMS, ROUTES, type RouteId } from '@/constants/routes';

interface BottomNavProps {
  current: RouteId;
  onNavigate: (route: RouteId) => void;
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

const ICONS: Record<RouteId, ReactNode> = {
  [ROUTES.event]: (
    <Icon>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </Icon>
  ),
  [ROUTES.roster]: (
    <Icon>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6M17 4.5a3.5 3.5 0 010 7M21.5 20c0-2.5-1.5-4.5-4-5.5" />
    </Icon>
  ),
  [ROUTES.history]: (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Icon>
  ),
  [ROUTES.settings]: (
    <Icon>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
    </Icon>
  ),
};

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
            {ICONS[item.id]}
          </span>
          <span className="bottom-nav__label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
