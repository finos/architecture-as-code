import { startTransition, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { NavigationType, useLocation, useNavigationType, type Location } from 'react-router-dom';

const KEY = 'calm-hub-entry-selection';
const MAX_ENTRIES = 50;
/** The field of history state that holds the id of an entry that the router did not create. */
const ENTRY_FIELD = 'calmHubEntry';

type EntryLocation = Pick<Location, 'key'>;
/** The browser history of the page, or a stand-in for tests. */
export type EntryHistory = Pick<History, 'state' | 'replaceState'>;

/**
 * The id of a history entry. React Router gives each entry that it makes a key, and keeps the key in history state, so
 * the key stays after a reload. The browser makes an entry with no state for a first visit or a URL that the user
 * pastes: the router gives all of them the key `default`, also two at the same URL. Such an entry gets its own id in
 * its history state, next to the fields of the router, when it first keeps a selection.
 */
function entryId(location: EntryLocation, history: EntryHistory | undefined, assign: boolean): string | undefined {
    if (location.key !== 'default') return location.key;
    const state: unknown = history?.state;
    // State with a router key is another entry: the browser left this one.
    if (state !== null && (typeof state !== 'object' || Array.isArray(state) || 'key' in state)) return undefined;
    const fields = (state ?? {}) as Record<string, unknown>;
    if (typeof fields[ENTRY_FIELD] === 'string') return `entry:${fields[ENTRY_FIELD]}`;
    if (!assign || !history) return undefined;
    const next = Math.random().toString(36).slice(2, 10);
    try {
        history.replaceState({ ...fields, [ENTRY_FIELD]: next }, '');
    } catch {
        return undefined;
    }
    return `entry:${next}`;
}

function read(storage: Storage | undefined): [string, string][] {
    try {
        const parsed: unknown = JSON.parse(storage?.getItem(KEY) ?? '[]');
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(
            (entry): entry is [string, string] =>
                Array.isArray(entry) && entry.length === 2 && entry.every((part) => typeof part === 'string')
        );
    } catch {
        return [];
    }
}

/** Reading the `sessionStorage` global itself throws when site data is blocked. */
export function sessionStore(): Storage | undefined {
    try {
        return sessionStorage;
    } catch {
        return undefined;
    }
}

/** The history of the page, which a router that reads the address bar shares. */
export function browserHistory(): EntryHistory | undefined {
    try {
        return window.history;
    } catch {
        return undefined;
    }
}

/**
 * The moves of the browser to another history entry: Back, Forward, `history.go()` and a URL that the user opens. A
 * move changes `entry`, also when the router gives the new entry the same location, as it does for two entries that the
 * browser made at the same URL. The router sets its location in a transition, and so does this hook, so one render
 * gets both. `hasMoved()` is true until a render gets the last move: an effect that keeps something for the entry
 * waits, because the browser already shows the next entry.
 */
export function useBrowserEntry() {
    const moves = useRef(0);
    const [entry, setEntry] = useState(0);
    useLayoutEffect(() => {
        const move = () => {
            const next = ++moves.current;
            startTransition(() => setEntry(next));
        };
        window.addEventListener('popstate', move);
        return () => window.removeEventListener('popstate', move);
    }, []);
    const hasMoved = useCallback(() => moves.current !== entry, [entry]);
    return { entry, hasMoved };
}

/** The element that the user selected on this history entry, so that Back and Forward open it again. */
export function readEntrySelection(storage: Storage | undefined, location: EntryLocation, history = browserHistory()): string | undefined {
    const id = entryId(location, history, false);
    return id === undefined ? undefined : read(storage).find(([entry]) => entry === id)?.[1];
}

/** Keeps the selection of this history entry, or forgets it. Only the last 50 entries keep one. */
export function writeEntrySelection(
    storage: Storage | undefined,
    location: EntryLocation,
    uniqueId: string | undefined,
    history = browserHistory()
): void {
    const id = entryId(location, history, uniqueId !== undefined);
    if (id === undefined) return;
    const entries = read(storage);
    if (entries.find(([entry]) => entry === id)?.[1] === uniqueId) return;
    const others = entries.filter(([entry]) => entry !== id);
    const next = uniqueId === undefined ? others : [...others, [id, uniqueId]].slice(-MAX_ENTRIES);
    try {
        storage?.setItem(KEY, JSON.stringify(next));
    } catch {
        // A full or blocked storage only loses the selection for Back and Forward.
    }
}

/**
 * A number that changes on each link and on each browser move (`entry` of useBrowserEntry), also to the URL that shows.
 * A link pushes a history entry and Back or Forward pops one. A replace that changes the URL, such as closing the
 * inspector, updates the page in place and keeps the number. React Router makes a link to the URL that shows a replace
 * too. The router gives each entry that the browser made the key `default`, and two of them at the same URL the same
 * location, so a count of these changes and of the browser moves tells each link apart.
 */
export function useLinkKey(browserEntry: number): number {
    const location = useLocation();
    const navigationType = useNavigationType();
    const url = `${location.pathname}${location.search}`;
    const [link, setLink] = useState({ location, browserEntry, url, linkKey: 0 });
    if (link.location === location && link.browserEntry === browserEntry) return link.linkKey;
    const isLink = link.browserEntry !== browserEntry || navigationType !== NavigationType.Replace || link.url === url;
    const next = { location, browserEntry, url, linkKey: link.linkKey + (isLink ? 1 : 0) };
    setLink(next);
    return next.linkKey;
}
