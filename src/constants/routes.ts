/** Hash-based routes (work on GitHub Pages sub-paths without server rewrites). */
export const ROUTES = {
  event: 'event',
  roster: 'roster',
  history: 'history',
  settings: 'settings',
} as const;

export type RouteId = (typeof ROUTES)[keyof typeof ROUTES];

export const DEFAULT_ROUTE: RouteId = ROUTES.event;

export const NAV_ITEMS: ReadonlyArray<{ id: RouteId; label: string; icon: string }> = [
  { id: ROUTES.event, label: 'This week', icon: '⚔' },
  { id: ROUTES.roster, label: 'Roster', icon: '☰' },
  { id: ROUTES.history, label: 'History', icon: '⟲' },
  { id: ROUTES.settings, label: 'Settings', icon: '⚙' },
];

export function isRouteId(value: string): value is RouteId {
  return (Object.values(ROUTES) as string[]).includes(value);
}
