import { createContext, ReactNode, useContext, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Location, NavigationType, useLocation, useNavigationType, useSearchParams } from 'react-router-dom';
import { ExtensionContext, ExtensionSummary, ScreenBlock, TableBlockValue } from '../../model/extensions.js';
import { SCREEN_STATE_LIMITS } from '../../navigation/destinations.js';
import { filterableTables, NO_FILTERS, readTableState, tableKeyCount, TableFilterState, writeTableState } from './tableFilters.js';

export interface TableStateStore {
    /** The newest filters of a table, also those that the page address does not show yet. */
    get(tableId: string): TableFilterState;
    /** Changes the filters of a table. `change` gets its newest filters, also when changes come faster than the page renders. */
    update(tableId: string, change: (state: TableFilterState) => TableFilterState): void;
    /** The table's filters are in memory only: the page URL has no room for them. */
    overflowed(tableId: string): boolean;
    /** Changes when the filters come from outside the tables, such as a link or Back, so that a search box shows them again. */
    origin: string;
}

/** The reply that a slot shows, so that its stat tiles and tables can find each other. */
export interface BlockScope {
    extension: ExtensionSummary;
    context: ExtensionContext;
    blocks: readonly ScreenBlock[];
    tables: ReadonlyMap<string, TableBlockValue>;
    /** Prefixes the DOM ids of the slot's tables, which the tiles control. */
    domId: string;
    state: TableStateStore;
}

export const BlockScopeContext = createContext<BlockScope | null>(null);

/** Outside a slot, a stat tile shows only its figure and a table has no filters. */
export const useBlockScope = () => useContext(BlockScopeContext);

export function useScopeTables(blocks: readonly ScreenBlock[] | undefined) {
    return useMemo(() => filterableTables(blocks ?? []), [blocks]);
}

// A Map, not an object: a table id such as `constructor` is valid, and must not find an Object property.
type Tables = ReadonlyMap<string, TableFilterState>;
const NO_TABLES: Tables = new Map();

function withTable(tables: Tables, tableId: string, state: TableFilterState | undefined): Tables {
    const next = new Map(tables);
    if (state) next.set(tableId, state);
    else next.delete(tableId);
    return next;
}

const TableStateContext = createContext<TableStateStore | null>(null);

// Each write carries its id in the history state, next to the fields that the state has. The router shows the state
// of a write with the write, so the store knows its own writes, also from a navigation with the same query.
const WRITE_ID = 'tableStateWrite';
// The browser keeps history state through a reload, so ids also name the page load.
const PAGE_LOAD = Math.random().toString(36).slice(2);

const writeIdOf = (state: unknown) => {
    const id = state !== null && typeof state === 'object' ? (state as Record<string, unknown>)[WRITE_ID] : undefined;
    return typeof id === 'string' ? id : undefined;
};

/** The state of a write: the state of the page with the write id. A state that is not an object stays, with no id. */
function withWriteId(state: unknown, id: string): unknown {
    if (state === null || state === undefined) return { [WRITE_ID]: id };
    return typeof state === 'object' && !Array.isArray(state) ? { ...state, [WRITE_ID]: id } : state;
}

interface Write {
    id: string;
    pathname: string;
}

interface UrlStore {
    /** The location that the store has seen, from `locationId`. */
    seen: string;
    /** The page query with the newest filters. The router can show it later. */
    query: string;
    /** The filters of the tables that the query has no room for. */
    memory: Tables;
    /** The query that the page address has, or gets from the last write. */
    written: string;
    /** The writes sent to the router that the page has not shown yet, oldest first. */
    pending: readonly Write[];
    /** Counts the writes. Each one goes to the router once, with the id `<store>.<count>`. */
    writes: number;
    origin: string;
}

/** React Router gives each location that the browser makes, such as an address typed in, the key `default`. */
const locationId = ({ key, pathname, search }: Location) => `${key} ${pathname}${search}`;

interface Shown {
    seen: string;
    pathname: string;
    query: string;
    type: NavigationType;
    writeId: string | undefined;
}

/** The store when the page shows a location. */
function showLocation(store: UrlStore, { seen, pathname, query: shown, type, writeId }: Shown): UrlStore {
    if (store.seen === seen) return store;
    // The router shows the writes of this store in order, and can skip some: the write that shows ends those before it.
    // A write is a replace on its own page with the id of a write that has not shown. A link, Back, an address typed in
    // and another replace are not, also with the query of a write.
    const own =
        type === NavigationType.Replace && writeId !== undefined
            ? store.pending.findIndex((write) => write.id === writeId && write.pathname === pathname)
            : -1;
    if (own >= 0) return { ...store, seen, pending: store.pending.slice(own + 1) };
    // Another navigation: the address sets the filters again, and the filters in memory end.
    return { ...store, seen, query: shown, written: shown, memory: NO_TABLES, pending: [], origin: seen };
}

/** Sends the newest query to the router once. Of the changes in one render, only the last goes to the router. */
function sendQuery(store: UrlStore, storeId: string, pathname: string): UrlStore {
    if (store.query === store.written) return store;
    const writes = store.writes + 1;
    return { ...store, written: store.query, pending: [...store.pending, { id: `${storeId}.${writes}`, pathname }], writes };
}

function changeFilters(store: UrlStore, tableId: string, change: (state: TableFilterState) => TableFilterState): UrlStore {
    const query = new URLSearchParams(store.query);
    const state = change(store.memory.get(tableId) ?? readTableState(query, tableId));
    const next = writeTableState(query, tableId, state);
    // Over the budget of the navigation contract, or with a value that it refuses, such as page 10001, the table's keys
    // leave the URL, so that the URL never holds filters it does not show. Return points keep at most these keys.
    const kept = readTableState(next, tableId);
    const fits =
        tableKeyCount(next) <= SCREEN_STATE_LIMITS.tableKeys &&
        kept.filter === state.filter &&
        kept.q === state.q &&
        kept.page === state.page;
    const memory = withTable(store.memory, tableId, fits ? undefined : state);
    return { ...store, memory, query: (fits ? next : writeTableState(query, tableId, NO_FILTERS)).toString() };
}

/**
 * Keeps the filters of the tables below it in the page URL, so Back, a reload and a link restore them. A filter
 * change replaces the history entry. It keeps the fields of its state, such as the return points of a page, and adds
 * the id of the write.
 */
export function UrlTableState({ children }: { children: ReactNode }) {
    const [params, setParams] = useSearchParams();
    const location = useLocation();
    const type = useNavigationType();
    const shown = params.toString();
    const seen = locationId(location);
    const { pathname } = location;
    // A store that mounts again is another store: the writes of the earlier one are not its writes.
    const storeId = `${PAGE_LOAD}${useId()}`;
    const [store, setStore] = useState<UrlStore>(() => ({
        seen,
        query: shown,
        memory: NO_TABLES,
        written: shown,
        pending: [],
        writes: 0,
        origin: seen,
    }));
    // The router shows a navigation in a transition, so the page can show a query late, or show one write before the
    // next. The tables read the store, and each change starts from its newest filters.
    if (store.seen !== seen || store.query !== store.written) {
        const page = { seen, pathname, query: shown, type, writeId: writeIdOf(location.state) };
        setStore((current) => sendQuery(showLocation(current, page), storeId, pathname));
    }
    const sent = useRef(store.writes);
    const { writes, written, query, memory, origin } = store;
    useLayoutEffect(() => {
        if (writes === sent.current) return;
        sent.current = writes;
        setParams(written, { replace: true, state: withWriteId(location.state, `${storeId}.${writes}`) });
    }, [writes, written, setParams, location.state, storeId]);
    const current = useMemo(() => new URLSearchParams(query), [query]);
    const value = useMemo<TableStateStore>(
        () => ({
            get: (tableId) => memory.get(tableId) ?? readTableState(current, tableId),
            update: (tableId, change) => setStore((latest) => changeFilters(latest, tableId, change)),
            overflowed: (tableId) => memory.has(tableId),
            origin,
        }),
        [memory, current, origin]
    );
    return <TableStateContext.Provider value={value}>{children}</TableStateContext.Provider>;
}

/**
 * The store of an `UrlTableState` above, or else one in memory for the slot context `scope`. Slots on an architecture
 * page keep their filters in memory: a query change there closes the node details. Another resource can have a table
 * with the same id, and its filters must not apply there.
 */
export function useTableStateStore(scope: string): TableStateStore {
    const url = useContext(TableStateContext);
    const [memory, setMemory] = useState<{ scope: string; tables: Tables }>({ scope, tables: NO_TABLES });
    const tables = memory.scope === scope ? memory.tables : NO_TABLES;
    const local = useMemo<TableStateStore>(
        () => ({
            get: (tableId) => tables.get(tableId) ?? NO_FILTERS,
            update: (tableId, change) =>
                setMemory((current) => {
                    const latest = current.scope === scope ? current.tables : NO_TABLES;
                    return { scope, tables: withTable(latest, tableId, change(latest.get(tableId) ?? NO_FILTERS)) };
                }),
            overflowed: () => false,
            origin: scope,
        }),
        [tables, scope]
    );
    return url ?? local;
}
