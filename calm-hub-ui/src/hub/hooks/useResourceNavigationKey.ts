import { useState } from 'react';
import type { Location } from 'react-router-dom';

// A location that the router did not create, such as a first page load or a hash that was
// edited by hand, has no history state, so React Router gives it the key `default`. For those
// locations the pathname identifies the navigation.
function navigationId(location: Location): string {
    return location.key === 'default' ? `${location.key}:${location.pathname}` : location.key;
}

/**
 * Returns a key that changes on each navigation, except a change to the query only, such as a
 * diagram tab. While the key stays the same, the page keeps the resource it loaded. A navigation
 * to the same path still changes the key, and so does a query-only change after the load failed,
 * so that the route loads the resource again.
 */
export function useResourceNavigationKey(location: Location, loadFailed: boolean): string {
    const id = navigationId(location);
    const [last, setLast] = useState({
        id,
        pathname: location.pathname,
        search: location.search,
        resourceKey: id,
    });
    if (last.id === id) return last.resourceKey;

    const keepsResource = !loadFailed && location.pathname === last.pathname && location.search !== last.search;
    const next = {
        id,
        pathname: location.pathname,
        search: location.search,
        resourceKey: keepsResource ? last.resourceKey : id,
    };
    setLast(next);
    return next.resourceKey;
}