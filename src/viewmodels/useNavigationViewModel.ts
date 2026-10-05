import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_ROUTE, isRouteId, type RouteId } from '@/constants/routes';

function readRoute(): RouteId {
  const hash = window.location.hash.replace(/^#\/?/, '');
  return isRouteId(hash) ? hash : DEFAULT_ROUTE;
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
