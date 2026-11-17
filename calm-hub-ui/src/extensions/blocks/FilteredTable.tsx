import { ComponentProps, RefObject, useRef, useState } from 'react';
import { TableBlockValue } from '../../model/extensions.js';
import { BlockScope } from './BlockScope.js';
import { SourceTable } from './SourceTable.js';
import { activeFilter, filterRows, NO_FILTERS, resultSummary, TableFilterState, TileFilter } from './tableFilters.js';
import { TableToolbar } from './TableToolbar.js';
import { TableView } from './TableView.js';

export interface TableControls {
    domId: string;
    state: TableFilterState;
    /** The tile filter that applies. */
    filter?: TileFilter;
    /** The search text that applies, without spaces at the ends. */
    q?: string;
    filtered: boolean;
    tableRef: RefObject<HTMLTableElement | null>;
    toolbar: Omit<ComponentProps<typeof TableToolbar>, 'summary'>;
    /** Moves `delta` pages from the newest page, within 1 to `pages`. */
    movePage: (delta: number, pages: number) => void;
}

function useTableControls(block: TableBlockValue, scope: BlockScope): TableControls {
    const tableId = block.id ?? '';
    const domId = `${scope.domId}-${tableId}`;
    const state = scope.state.get(tableId);
    const filter = activeFilter(scope.blocks, scope.tables, tableId, state);
    const q = state.q?.trim() || undefined;
    const filtered = filter !== undefined || q !== undefined;
    const searchRef = useRef<HTMLInputElement>(null);
    const tableRef = useRef<HTMLTableElement>(null);
    // Counts Clear filters, which drops search text that the box did not commit yet, also when the search is empty.
    const [clears, setClears] = useState(0);
    const set = (next: Partial<TableFilterState>) => scope.state.update(tableId, (current) => ({ ...current, ...next }));
    return {
        domId,
        state,
        filter,
        q,
        filtered,
        tableRef,
        movePage: (delta, pages) =>
            scope.state.update(tableId, (current) => ({ ...current, page: Math.min(Math.max(1, current.page + delta), pages) })),
        toolbar: {
            filtered,
            controls: domId,
            overflowed: scope.state.overflowed(tableId),
            // The Clear filters button goes away, so focus moves to the search, or else to the table.
            onClear: () => {
                scope.state.update(tableId, () => NO_FILTERS);
                setClears((count) => count + 1);
                (searchRef.current ?? tableRef.current)?.focus();
            },
            search: block.search
                ? {
                      label: typeof block.search.label === 'string' && block.search.label ? block.search.label : 'Filter rows',
                      value: state.q ?? '',
                      resetKey: `${scope.state.origin} ${clears}`,
                      // A source route gets one request when typing stops, not one for each key.
                      delay: block.source ? 300 : 0,
                      onCommit: (text) => set({ q: text || undefined, page: NO_FILTERS.page }),
                  }
                : undefined,
            searchRef,
        },
    };
}

/** Inline rows are the whole dataset, so the browser filters them. */
function LocalTable({ block, controls }: { block: TableBlockValue; controls: TableControls }) {
    const { filter, q, filtered } = controls;
    const rows = filterRows(block, filter, q);
    return (
        <>
            <TableToolbar summary={resultSummary(rows.length, block.rows.length, filter, q)} {...controls.toolbar} />
            <TableView
                id={controls.domId}
                tableRef={controls.tableRef}
                columns={block.columns}
                rows={rows}
                empty={filtered ? 'No rows match these filters.' : 'No rows.'}
            />
        </>
    );
}

export function FilteredTable({ block, scope }: { block: TableBlockValue; scope: BlockScope }) {
    const controls = useTableControls(block, scope);
    return (
        <div className="flex flex-col gap-2">
            {block.source ? (
                <SourceTable block={block} scope={scope} controls={controls} />
            ) : (
                <LocalTable block={block} controls={controls} />
            )}
        </div>
    );
}
