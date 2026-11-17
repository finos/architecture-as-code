import { createContext, useContext } from 'react';
import type { Path } from 'react-router-dom';
import { CHAT_PATH, resourcePath, screenRoutePath, SEARCH_PATH } from '../hub/routes.js';
import { EXACT_VERSION_PARAM } from '../hub/components/diagram-section/tabs/diagramTabRegistry.js';

/** A page that a user can return to. Each kind maps to one Hub route, so a return point holds no URL. */
export type ReturnPage =
    | { kind: 'resource'; namespace: string; type: string; id: string; version: string }
    | { kind: 'screen'; extension: string; screen: string }
    | { kind: 'search' }
    | { kind: 'chat' };

/**
 * A page and its view state, in history state only (`location.state.returnTo`). `search` is the page's query as it
 * was, such as a tab, a selected node or table filters. It never holds form input, which never goes in a URL.
 */
export interface ReturnPoint {
    page: ReturnPage;
    search: string;
    label: string;
}

export const MAX_RETURN_POINTS = 5;
// Above the longest valid screen query, so a return point keeps all of it: about 24,500 characters when each value
// character is percent-encoded (SCREEN_STATE_LIMITS: the route query plus twelve table searches).
const MAX_SEARCH = 32_768;
const MAX_LABEL = 200;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isPart = (value: unknown) => typeof value === 'string' && value !== '' && value !== '.' && value !== '..';

function isReturnPage(value: unknown): value is ReturnPage {
    if (!isObject(value)) return false;
    switch (value.kind) {
        case 'resource':
            return [value.namespace, value.type, value.id, value.version].every(isPart);
        case 'screen':
            return [value.extension, value.screen].every(isPart);
        case 'search':
        case 'chat':
            return true;
        default:
            return false;
    }
}

const isReturnPoint = (value: unknown): value is ReturnPoint =>
    isObject(value) &&
    isReturnPage(value.page) &&
    typeof value.search === 'string' &&
    value.search.length <= MAX_SEARCH &&
    (value.search === '' || value.search.startsWith('?')) &&
    typeof value.label === 'string';

/**
 * A label of at most 200 characters, counted in code points as the URL limits are. A longer one ends in "…": a long
 * page title must not cost the way back. The slice bounds the work for a label from older history state.
 */
export function boundLabel(label: string): string {
    if (label.length <= MAX_LABEL) return label;
    const characters = [...label.slice(0, 2 * MAX_LABEL + 2)];
    return characters.length <= MAX_LABEL ? characters.join('') : `${characters.slice(0, MAX_LABEL - 1).join('')}…`;
}

/** The history state of a version that the user picks in the timeline. */
export const EXACT_VERSION_STATE = { timelineSelection: true } as const;

/**
 * Whether a navigation opens the exact version in its URL: a typed Hub link or a return (`exact=1`), or a timeline
 * pick. Otherwise DiagramSection opens the current moment for the latest version of an architecture with a timeline.
 */
export const isExactVersion = ({ search, state }: { search: string; state: unknown }): boolean =>
    new URLSearchParams(search).get(EXACT_VERSION_PARAM) === '1' || (isObject(state) && state.timelineSelection === true);

// History state is untyped and can come from an older session, so each entry is checked, as Hub does for breadcrumbs.
export function readReturnPoints(state: unknown): ReturnPoint[] {
    const list = isObject(state) ? state.returnTo : undefined;
    return Array.isArray(list)
        ? list
              .filter(isReturnPoint)
              .slice(-MAX_RETURN_POINTS)
              .map((point) => ({ ...point, label: boundLabel(point.label) }))
        : [];
}

/** The state that keeps the return points through another navigation, such as a breadcrumb or a detailed architecture. */
export function carryReturnPoints(state: unknown): { returnTo?: ReturnPoint[] } {
    const returnTo = readReturnPoints(state);
    return returnTo.length > 0 ? { returnTo } : {};
}

function pagePath(page: ReturnPage): string {
    switch (page.kind) {
        case 'resource':
            return resourcePath(page);
        case 'screen':
            return screenRoutePath(page.extension, page.screen);
        case 'search':
            return SEARCH_PATH;
        case 'chat':
            return CHAT_PATH;
    }
}

/** A return to a resource page opens the version that the user left, also from a copied link: it adds `exact=1`. */
export function returnPointLocation(point: ReturnPoint): Path {
    if (point.page.kind !== 'resource') return { pathname: pagePath(point.page), search: point.search, hash: '' };
    const query = new URLSearchParams(point.search);
    query.set(EXACT_VERSION_PARAM, '1');
    return { pathname: pagePath(point.page), search: `?${query.toString()}`, hash: '' };
}

/** The current page as a return point, and the points before it. Null on a page that records none. */
export const ReturnPointContext = createContext<{ point: ReturnPoint; earlier: ReturnPoint[] } | null>(null);

/**
 * The history state for a link from this page: the page joins the return points, so the next page can link back. A
 * link to `to` on this same page, such as a filter, changes only its view: it keeps the points and adds none.
 */
export function useLinkState(to?: Pick<Path, 'pathname'>): { returnTo: ReturnPoint[] } | undefined {
    const here = useContext(ReturnPointContext);
    if (!here) return undefined;
    const samePage = to !== undefined && to.pathname === pagePath(here.point.page);
    const returnTo = samePage ? here.earlier : [...here.earlier, here.point].slice(-MAX_RETURN_POINTS);
    return returnTo.length > 0 ? { returnTo } : undefined;
}
