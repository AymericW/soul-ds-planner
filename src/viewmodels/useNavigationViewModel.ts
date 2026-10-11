import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_ROUTE, isRouteId, parseHash, type RouteId } from '@/constants/routes';

function readRoute(): RouteId {
  const { path } = parseHash(window.location.hash);
  return isRouteId(path) ? path : DEFAULT_ROUTE;
}

/** Tiny hash router: keeps the current screen in the URL so reloads and the back button work. */
export function useNavigationViewModel() {
  const [route, setRoute] = useState<RouteId>(() => readRoute());

  useEffect(() => {
    const onHashChange = () => setRoute(readRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((next: RouteId) => {
    if (readRoute() !== next) window.location.hash = `/${next}`;
    setRoute(next);
    window.scrollTo({ top: 0 });
  }, []);

  return { route, navigate };
}

/** Query parameters of the current hash route, e.g. the join code of `#/join?code=AB12`. */
export function readHashParams(): URLSearchParams {
  return parseHash(window.location.hash).params;
}
