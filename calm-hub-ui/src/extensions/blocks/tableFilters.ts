import { CellValue, ScreenBlock, StatFilter, TableBlockValue, TableRowsReply } from '../../model/extensions.js';
import { isTableStateEntry } from '../../navigation/destinations.js';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
// A table id is the name part of its keys, so a valid id makes valid key names.
const isTableId = (id: string) => isTableStateEntry(`${id}.filter`, '');

/** The filters of one table. `filter` is the `id` of a tile filter, `q` the search text, and `page` starts at 1. */
export interface TableFilterState {
    filter?: string;
    q?: string;
    page: number;
}

export const NO_FILTERS: TableFilterState = { page: 1 };

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** The text that a cell shows: a badge's text or a link's label. A filter and a search compare this text. */
export function cellText(cell: CellValue | undefined): string {
    if (typeof cell === 'string') return cell;
    if (typeof cell === 'number') return String(cell);
    if (isObject(cell)) {
        if (typeof cell.badge === 'string') return cell.badge;
        if (typeof cell.label === 'string') return cell.label;
    }
    return '';
}

/** The tables that tiles, a search or a source can filter, by id. A second table with the same id is not filterable. */
export function filterableTables(blocks: readonly ScreenBlock[]): Map<string, TableBlockValue> {
    const tables = new Map<string, TableBlockValue>();
    for (const block of blocks) {
        if (block?.type !== 'table' || typeof block.id !== 'string' || !isTableId(block.id) || tables.has(block.id)) continue;
        if (!Array.isArray(block.columns)) continue;
        tables.set(block.id, block);
    }
    return tables;
}

/**
 * The filter of a stat tile, if the tile can filter: its table is in the reply, and a filter `id` either goes to the
 * table's `source`, or names a column of the table's inline rows and a text value. Otherwise the tile shows only its
 * figure, as a tile without a filter does.
 */
export function usableFilter(filter: unknown, tables: ReadonlyMap<string, TableBlockValue>): StatFilter | undefined {
    if (!isObject(filter) || typeof filter.table !== 'string') return undefined;
    const table = tables.get(filter.table);
    if (!table) return undefined;
    if (filter.id === undefined) return { table: filter.table };
    if (typeof filter.id !== 'string' || filter.id === '' || !isTableStateEntry(`${filter.table}.filter`, filter.id)) return undefined;
    if (table.source) return { table: filter.table, id: filter.id };
    if (typeof filter.column !== 'string' || !table.columns.includes(filter.column) || typeof filter.value !== 'string') return undefined;
    return { table: filter.table, id: filter.id, column: filter.column, value: filter.value };
}

export interface TileFilter extends StatFilter {
    label: string;
}

/** Each tile filter with an `id` for the table, from every `stats` block of the reply. The first tile with an id wins. */
export function tileFilters(
    blocks: readonly ScreenBlock[],
    tables: ReadonlyMap<string, TableBlockValue>,
    tableId: string
): Map<string, TileFilter> {
    const filters = new Map<string, TileFilter>();
    for (const block of blocks) {
        if (block?.type !== 'stats' || !Array.isArray(block.items)) continue;
        for (const item of block.items) {
            const filter = usableFilter(item?.filter, tables);
            if (filter?.table === tableId && filter.id !== undefined && !filters.has(filter.id)) {
                filters.set(filter.id, { ...filter, label: typeof item.label === 'string' ? item.label : filter.id });
            }
        }
    }
    return filters;
}

/** The tile filter that the state selects. An id that no tile of the reply declares selects none. */
export function activeFilter(
    blocks: readonly ScreenBlock[],
    tables: ReadonlyMap<string, TableBlockValue>,
    tableId: string,
    state: TableFilterState
): TileFilter | undefined {
    return state.filter === undefined ? undefined : tileFilters(blocks, tables, tableId).get(state.filter);
}

/** The table has filters for the user: a search, a source, or a tile that targets it. */
export function hasFilters(table: TableBlockValue, blocks: readonly ScreenBlock[], tables: ReadonlyMap<string, TableBlockValue>): boolean {
    if (tables.get(table.id ?? '') !== table) return false;
    if (table.search || table.source) return true;
    return blocks.some(
        (block) =>
            block?.type === 'stats' &&
            Array.isArray(block.items) &&
            block.items.some((item) => usableFilter(item?.filter, tables)?.table === table.id)
    );
}

function searchColumns(table: TableBlockValue): number[] {
    const all = table.columns.map((_, index) => index);
    const named = Array.isArray(table.search?.columns)
        ? table.search.columns.map((name) => table.columns.indexOf(name)).filter((index) => index >= 0)
        : [];
    return named.length > 0 ? named : all;
}

/** The inline rows that match a tile filter and the search text. The rows are the full dataset, not one page. */
export function filterRows(table: TableBlockValue, filter: TileFilter | undefined, q: string | undefined): CellValue[][] {
    let rows = table.rows;
    if (filter?.column !== undefined) {
        const column = table.columns.indexOf(filter.column);
        rows = rows.filter((row) => cellText(row[column]) === filter.value);
    }
    const text = q?.trim().toLowerCase();
    if (text) {
        const columns = searchColumns(table);
        rows = rows.filter((row) => columns.some((column) => cellText(row[column]).toLowerCase().includes(text)));
    }
    return rows;
}

const stateKey = (tableId: string, part: keyof TableFilterState) => `${tableId}.${part}`;

/** The filters of a table from the page query: `<tableId>.filter`, `<tableId>.q` and `<tableId>.page`. A key that
 * `isTableStateEntry` refuses, which only a hand-edited URL has, is ignored. */
export function readTableState(params: URLSearchParams, tableId: string): TableFilterState {
    const read = (part: keyof TableFilterState) => {
        const value = params.get(stateKey(tableId, part));
        return value && isTableStateEntry(stateKey(tableId, part), value) ? value : undefined;
    };
    const page = read('page');
    return { filter: read('filter'), q: read('q'), page: page ? Number(page) : 1 };
}

/** The page query with the filters of a table. Default values are left out, so an unfiltered table adds no key. */
export function writeTableState(params: URLSearchParams, tableId: string, state: TableFilterState): URLSearchParams {
    const next = new URLSearchParams(params);
    const set = (part: keyof TableFilterState, value: string | undefined) => {
        const key = stateKey(tableId, part);
        if (value && isTableStateEntry(key, value)) next.set(key, value);
        else next.delete(key);
    };
    set('filter', state.filter);
    set('q', state.q);
    set('page', String(state.page));
    return next;
}

/** The table keys of the URL that the navigation contract accepts. A key named twice counts once. */
export const tableKeyCount = (params: URLSearchParams) =>
    new Set([...params.entries()].filter(([key, value]) => isTableStateEntry(key, value)).map(([key]) => key)).size;

export const pageSizeOf = (table: TableBlockValue) => {
    const size = table.source?.pageSize;
    return typeof size === 'number' && Number.isInteger(size) && size >= 1 ? Math.min(size, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;
};

const isCell = (cell: unknown) => typeof cell === 'string' || typeof cell === 'number' || isObject(cell);

/** A rows reply that the table can show: the extension's contract version, rows of cells, and a whole `total`. */
export function isRowsReply(reply: unknown, hubApi: number): reply is TableRowsReply {
    if (!isObject(reply) || reply.hubApi !== hubApi || !Array.isArray(reply.rows)) return false;
    const { total } = reply;
    return (
        typeof total === 'number' &&
        Number.isSafeInteger(total) &&
        total >= 0 &&
        reply.rows.every((row) => Array.isArray(row) && row.every(isCell))
    );
}

const rows = (count: number) => `${count} ${count === 1 ? 'row' : 'rows'}`;

/**
 * The result line: the number of rows, then the tile filter and the search text that apply. For inline rows it counts
 * the rows that match and all rows. A source says only how many rows match, so its line has one figure; before its
 * rows load, `count` is the state, such as "Loading rows…". Tile figures are the extension's own and stay as they are.
 */
export function resultSummary(
    count: number | string,
    all: number | undefined,
    filter: TileFilter | undefined,
    q: string | undefined
): string {
    const filtered = filter !== undefined || !!q;
    const figure =
        typeof count === 'string'
            ? count
            : !filtered
              ? rows(count)
              : all === undefined
                ? `${rows(count)} match`
                : `${count} of ${rows(all)}`;
    return [figure, filter?.label, q ? `“${q}”` : undefined].filter(Boolean).join(' · ');
}
