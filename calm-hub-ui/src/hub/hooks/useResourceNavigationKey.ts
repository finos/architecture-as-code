import { useState } from 'react';
import type { Location } from 'react-router-dom';

/**
 * Returns a key that changes on each navigation, except a change to the query only, such as a
 * diagram tab. While the key stays the same, the page keeps the resource it loaded. A navigation
 * to the same path still changes the key, and so does a query-only change after the load failed,
 * so that the route loads the resource again.
 */
export function useResourceNavigationKey(location: Location, loadFailed: boolean): string {
    const [last, setLast] = useState({
        key: location.key,
        pathname: location.pathname,
        search: location.search,
        resourceKey: location.key,
    });
    if (last.key === location.key) return last.resourceKey;

    const keepsResource = !loadFailed && location.pathname === last.pathname && location.search !== last.search;
    const next = {
        key: location.key,
        pathname: location.pathname,
        search: location.search,
        resourceKey: keepsResource ? last.resourceKey : location.key,
    };
    setLast(next);
    return next.resourceKey;
}
