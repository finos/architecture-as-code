import { useMemo, useState } from 'react';
import { TableBlockValue } from '../../model/extensions.js';
import { useExtensionService } from '../ExtensionsContext.js';
import { useExtensionRevision } from '../extensionRefresh.js';
import { RetryAlert } from '../RetryAlert.js';
import { useSlotActive } from '../slotActivity.js';
import { useRefreshingRequest } from '../useRefreshingRequest.js';
import { BlockScope } from './BlockScope.js';
import type { TableControls } from './FilteredTable.js';
import { isRowsReply, pageSizeOf, resultSummary } from './tableFilters.js';
import { TablePager } from './TablePager.js';
import { TableToolbar } from './TableToolbar.js';
import { TableView } from './TableView.js';

/**
 * A table whose rows come one page at a time from a read-only route. The route filters the whole dataset; the browser
 * never filters a page. The rows show only for the filters and the page they were loaded for.
 */
export function SourceTable({ block, scope, controls }: { block: TableBlockValue; scope: BlockScope; controls: TableControls }) {
    const service = useExtensionService();
    const { extension } = scope;
    const revision = useExtensionRevision(extension.id);
    // A hidden slot sends no request: a refresh or a search waits until the table shows again.
    const active = useSlotActive();
    const routeId = block.source?.route;
    const route = extension.routes.find((entry) => entry.id === routeId && entry.method === 'GET' && entry.readOnly);
    const pageSize = pageSizeOf(block);
    const { filter, q, filtered, state } = controls;
    const { page } = state;
    const filterId = filter?.id;
    const { namespace, resource, resourceType, resourceId, version, selectedElement } = scope.context;
    const { load, tooLong } = useMemo(() => {
        if (!route) return { tooLong: false };
        const query = {
            namespace,
            resource,
            resourceType,
            resourceId,
            version,
            selectedElement,
            filter: filterId,
            q,
            page: String(page),
            pageSize: String(pageSize),
        };
        // Hub would refuse the request with 414. The filters and the search text stay, so the user can change them.
        if (!service.fitsRequestLine(extension.id, route, query)) return { tooLong: true };
        if (!active) return { tooLong: false };
        return {
            tooLong: false,
            load: (signal: AbortSignal) =>
                service.call(extension.id, route, query, signal).then((reply) => {
                    if (!isRowsReply(reply, extension.hubApi)) throw new Error('Invalid table rows reply');
                    return reply;
                }),
        };
    }, [
        service,
        extension.id,
        extension.hubApi,
        route,
        active,
        namespace,
        resource,
        resourceType,
        resourceId,
        version,
        selectedElement,
        filterId,
        q,
        page,
        pageSize,
    ]);
    const filterKey = JSON.stringify([
        extension.id,
        routeId,
        namespace,
        resource,
        resourceType,
        resourceId,
        version,
        selectedElement,
        filterId,
        q,
        pageSize,
    ]);
    const { value, loading, failed, retrying, retry } = useRefreshingRequest(JSON.stringify([filterKey, page]), revision, load);

    // The pager keeps the last total for these filters while another page loads, so its buttons keep their place.
    const [known, setKnown] = useState<{ key: string; total: number }>();
    if (value && (known?.key !== filterKey || known.total !== value.total)) setKnown({ key: filterKey, total: value.total });
    const total = known?.key === filterKey ? known.total : undefined;
    const pages = total === undefined ? undefined : Math.max(1, Math.ceil(total / pageSize));

    if (!route) {
        return <p role="alert">Table source route unavailable.</p>;
    }
    const summary = resultSummary(value ? value.total : loading ? 'Loading rows…' : 'No rows loaded', undefined, filter, q);
    const empty = !value
        ? 'Loading rows…'
        : page > 1 && value.total > 0
          ? 'This page has no rows.'
          : filtered
            ? 'No rows match these filters.'
            : 'No rows.';
    const problemId = `${controls.domId}-problem`;
    const { search } = controls.toolbar;
    return (
        <>
            <TableToolbar
                summary={summary}
                {...controls.toolbar}
                search={search && tooLong && q ? { ...search, problem: problemId } : search}
            />
            {tooLong && (
                <p id={problemId} role="alert" className="alert alert-warning alert-soft text-base-content">
                    {q
                        ? 'The search is too long to send to the extension. Shorten it to load the rows.'
                        : 'The request for these rows is too long to send to the extension.'}
                </p>
            )}
            {(failed || retrying) && (
                <RetryAlert
                    message={value ? 'Could not refresh the rows. This shows the rows from before.' : 'The rows could not be loaded.'}
                    retrying={retrying}
                    onRetry={retry}
                />
            )}
            {(value || loading) && (
                <TableView
                    id={controls.domId}
                    tableRef={controls.tableRef}
                    columns={block.columns}
                    rows={value?.rows ?? []}
                    busy={loading}
                    empty={empty}
                />
            )}
            {pages !== undefined && (pages > 1 || page > 1) && (
                <TablePager page={page} pages={pages} onMove={(delta) => controls.movePage(delta, pages)} controls={controls.domId} />
            )}
        </>
    );
}
