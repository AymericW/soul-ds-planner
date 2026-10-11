/** Hash-based routes (work on GitHub Pages sub-paths without server rewrites). */
export const ROUTES = {
  event: 'event',
  roster: 'roster',
  requests: 'requests',
  history: 'history',
  settings: 'settings',
  /** Public page for players (no login, no navigation): `#/join?code=…`. */
  join: 'join',
} as const;

export type RouteId = (typeof ROUTES)[keyof typeof ROUTES];

export const DEFAULT_ROUTE: RouteId = ROUTES.event;

/** Routes that render without signing in. */
export const PUBLIC_ROUTES: readonly RouteId[] = [ROUTES.join];

export const NAV_ITEMS: ReadonlyArray<{ id: RouteId; label: string; icon: string }> = [
  { id: ROUTES.event, label: 'This week', icon: '⚔' },
  { id: ROUTES.roster, label: 'Roster', icon: '☰' },
  { id: ROUTES.requests, label: 'Requests', icon: '✉' },
  { id: ROUTES.history, label: 'History', icon: '⟲' },
  { id: ROUTES.settings, label: 'Settings', icon: '⚙' },
];

export function isRouteId(value: string): value is RouteId {
  return (Object.values(ROUTES) as string[]).includes(value);
}

/** Splits "#/join?code=AB12" into the route part and its query parameters. */
export function parseHash(hash: string): { path: string; params: URLSearchParams } {
  const raw = hash.replace(/^#\/?/, '');
  const q = raw.indexOf('?');
  return q === -1 ? { path: raw, params: new URLSearchParams() } : { path: raw.slice(0, q), params: new URLSearchParams(raw.slice(q + 1)) };
}
