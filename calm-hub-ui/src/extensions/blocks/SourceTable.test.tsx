import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExtensionContext, ExtensionRoute, ExtensionSummary, ScreenBlock } from '../../model/extensions.js';
import { ExtensionQuery, ExtensionService } from '../../service/extension-service.js';
import { ExtensionSlot } from '../ExtensionSlot.js';
import { ExtensionsProvider } from '../ExtensionsContext.js';
import { useExtensionRefresh } from '../extensionRefresh.js';
import { SCREEN_STATE_LIMITS } from '../../navigation/destinations.js';
import { UrlTableState } from './BlockScope.js';

const route = (id: string, method = 'GET', readOnly = true): ExtensionRoute => ({
    id,
    method,
    path: `/${id}`,
    scope: 'authenticated',
    readOnly,
});
const extension: ExtensionSummary = {
    id: 'delivery',
    name: 'Delivery',
    hubApi: 0,
    routes: [route('screen'), route('rows'), route('builds'), route('write', 'POST', false), route('unsafe', 'GET', false)],
    contributes: {},
};
const contribution = { id: 'deployments', title: 'Deployments', route: 'screen' };
const action = { id: 'approve', title: 'Approve', route: 'write' };

const screenReply = (failed: number, source = 'rows'): { hubApi: number; blocks: ScreenBlock[] } => ({
    hubApi: 0,
    blocks: [
        {
            type: 'stats',
            items: [
                { label: 'All deployments', value: 45, filter: { table: 'deploys' } },
                { label: 'Failed', value: failed, filter: { table: 'deploys', id: 'failed' } },
                { label: 'Succeeded', value: 38, filter: { table: 'deploys', id: 'succeeded' } },
            ],
        },
        {
            type: 'table',
            id: 'deploys',
            columns: ['Deployment', 'Result'],
            // Rows for a Hub that does not read `source`: never filtered in the browser.
            rows: [['inline-only', 'failed']],
            search: { label: 'Filter deployments' },
            source: { route: source, pageSize: 3 },
        },
    ],
});

interface Pending {
    route: string;
    query: ExtensionQuery;
    signal?: AbortSignal;
    resolve: (value: unknown) => void;
    reject: (error: unknown) => void;
}

function mockCalls() {
    const calls: Pending[] = [];
    vi.spyOn(ExtensionService.prototype, 'call').mockImplementation(
        (_id, route, query, signal) =>
            new Promise((resolve, reject) => {
                calls.push({ route: route.id, query, signal, resolve, reject });
            })
    );
    const pending = (id: string) => calls.filter((call) => call.route === id);
    const last = (id: string) => pending(id).at(-1)!;
    return { calls, pending, last };
}

const rowsReply = (names: string[], total: number) => ({ hubApi: 0, rows: names.map((name) => [name, 'x']), total });
const shownRows = () =>
    within(screen.getByRole('table'))
        .getAllByRole('row')
        .slice(1)
        .map((row) => within(row).getAllByRole('cell')[0].textContent);

function RefreshButton() {
    const refresh = useExtensionRefresh();
    return <button onClick={() => refresh.refresh('delivery')}>Refresh delivery</button>;
}

function Address() {
    return <output data-testid="address">{useLocation().search}</output>;
}

function renderSlot({ withAction = false, search = '', context }: { withAction?: boolean; search?: string; context?: ExtensionContext } = {}) {
    const service = new ExtensionService();
    vi.spyOn(service, 'fetchExtensions').mockReturnValue(new Promise(() => {}));
    return render(
        <ExtensionsProvider service={service}>
            <MemoryRouter initialEntries={[`/screen${search}`]}>
                <UrlTableState>
                    <ExtensionSlot extension={extension} contribution={contribution} context={context} headingLevel={1} />
                </UrlTableState>
                {withAction && <ExtensionSlot action placement="test" extension={extension} contribution={action} />}
                <RefreshButton />
                <Address />
            </MemoryRouter>
        </ExtensionsProvider>
    );
}

const typingStops = () =>
    act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 400));
    });
const address = () => new URLSearchParams(screen.getByTestId('address').textContent ?? '');
const OVERFLOW_NOTICE = 'These filters are not kept in the page address.';

// A selected element of 140 emoji, so that a search of about 190 characters fills the request line.
const longContext: ExtensionContext = {
    namespace: 'demo',
    resourceType: 'architectures',
    resourceId: '1',
    version: '1.0.0',
    selectedElement: '😀'.repeat(140),
};

// The request line that Hub reads for the `rows` route: method, path with the URL-encoded query, and HTTP version.
const requestLine = (query: ExtensionQuery) => {
    const pairs = Object.entries(query).flatMap(([key, value]) => (value === undefined ? [] : [`${key}=${encodeURIComponent(value)}`]));
    return `GET /api/calm/extensions/delivery/api/rows?${pairs.join('&')} HTTP/1.1`;
};

/** A search that makes the first request for `deploys` exactly `length` characters long. '𝄞' encodes to 12. */
function searchForLine(length: number) {
    const room = length - requestLine({ ...longContext, q: '', page: '1', pageSize: '3' }).length;
    return '𝄞'.repeat(Math.floor(room / 12)) + 'a'.repeat(room % 12);
}

afterEach(() => vi.restoreAllMocks());

describe('a table with a source route', () => {
    it('sends the filters to the route, and shows only the reply for the latest filters', async () => {
        const { last, pending } = mockCalls();
        renderSlot();
        await act(async () => last('screen').resolve(screenReply(7)));
        expect(last('rows').query).toMatchObject({ page: '1', pageSize: '3' });
        expect(last('rows').query.filter).toBeUndefined();
        await act(async () => last('rows').resolve(rowsReply(['d1', 'd2', 'd3'], 45)));
        expect(shownRows()).toEqual(['d1', 'd2', 'd3']);
        expect(screen.getByText('45 rows')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Failed/ }));
        const failed = last('rows');
        expect(failed.query).toMatchObject({ filter: 'failed', page: '1' });
        expect(screen.getByText('Loading rows…', { selector: 'td' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Succeeded/ }));
        const succeeded = last('rows');
        expect(failed.signal?.aborted).toBe(true);
        await act(async () => succeeded.resolve(rowsReply(['s1', 's2', 's3'], 38)));
        await act(async () => failed.resolve(rowsReply(['f1'], 7)));

        expect(shownRows()).toEqual(['s1', 's2', 's3']);
        expect(screen.getByText('38 rows match · Succeeded')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Failed/ })).toHaveTextContent('7');
        expect(screen.queryByText('inline-only')).toBeNull();
        expect(pending('rows')).toHaveLength(3);
    });

    it('sends the search text when typing stops, and starts again at page 1', async () => {
        const { last, pending } = mockCalls();
        renderSlot();
        await act(async () => last('screen').resolve(screenReply(7)));
        await act(async () => last('rows').resolve(rowsReply(['d1', 'd2', 'd3'], 45)));
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        expect(last('rows').query).toMatchObject({ page: '2' });

        const search = screen.getByRole('searchbox', { name: 'Filter deployments' });
        fireEvent.change(search, { target: { value: 'pa' } });
        fireEvent.change(search, { target: { value: 'pay' } });
        await waitFor(() => expect(last('rows').query).toMatchObject({ q: 'pay', page: '1' }));
        expect(pending('rows').filter((call) => call.query.q === 'pa')).toHaveLength(0);
    });

    it('pages through the rows, and keeps the pager while a page loads', async () => {
        const { last } = mockCalls();
        renderSlot();
        await act(async () => last('screen').resolve(screenReply(7)));
        fireEvent.click(screen.getByRole('button', { name: /Failed/ }));
        await act(async () => last('rows').resolve(rowsReply(['f1', 'f2', 'f3'], 7)));
        expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Previous' })).toHaveAttribute('aria-disabled', 'true');

        const next = screen.getByRole('button', { name: 'Next' });
        fireEvent.click(next);
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        expect(last('rows').query).toMatchObject({ filter: 'failed', page: '3' });
        expect(screen.getByText('Page 3 of 3')).toBeInTheDocument();
        await act(async () => last('rows').resolve(rowsReply(['f7'], 7)));
        expect(shownRows()).toEqual(['f7']);
        expect(screen.getByRole('button', { name: 'Next' })).toHaveAttribute('aria-disabled', 'true');
        expect(screen.getByRole('button', { name: 'Next' })).toBe(next);
    });

    it('moves from the newest page when a press comes before the page shows the one before it', async () => {
        const { last } = mockCalls();
        renderSlot();
        await act(async () => last('screen').resolve(screenReply(7)));
        await act(async () => last('rows').resolve(rowsReply(['a1', 'a2', 'a3'], 45)));
        act(() => {
            const next = screen.getByRole('button', { name: 'Next' });
            fireEvent.click(next);
            fireEvent.click(next);
        });
        expect(last('rows').query).toMatchObject({ page: '3' });

        await act(async () => last('rows').resolve(rowsReply(['a7', 'a8', 'a9'], 45)));
        // A tile starts again at page 1, so Next goes to page 2 of its rows, not to page 4.
        act(() => {
            fireEvent.click(screen.getByRole('button', { name: /Failed/ }));
            fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        });
        expect(last('rows').query).toMatchObject({ filter: 'failed', page: '2' });
    });

    it('drops search text that it did not send yet when Clear filters is pressed', async () => {
        const { last, pending } = mockCalls();
        renderSlot();
        await act(async () => last('screen').resolve(screenReply(7)));
        fireEvent.click(screen.getByRole('button', { name: /Failed/ }));
        const search = screen.getByRole('searchbox', { name: 'Filter deployments' });
        fireEvent.change(search, { target: { value: 'order' } });
        fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 400));
        });

        expect(search).toHaveValue('');
        expect(last('rows').query.filter).toBeUndefined();
        expect(pending('rows').filter((call) => call.query.q !== undefined)).toHaveLength(0);
    });

    it('says the rows could not load, keeps the filters, and tries again', async () => {
        const { last } = mockCalls();
        renderSlot();
        await act(async () => last('screen').resolve(screenReply(7)));
        fireEvent.click(screen.getByRole('button', { name: /Failed/ }));
        await act(async () => last('rows').reject(new Error('down')));
        expect(screen.getByRole('alert')).toHaveTextContent('The rows could not be loaded.');
        expect(screen.getByText('No rows loaded · Failed')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Failed/ })).toHaveAttribute('aria-pressed', 'true');

        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
        expect(screen.getByRole('button', { name: 'Trying again…' })).toHaveAttribute('aria-disabled', 'true');
        expect(last('rows').query).toMatchObject({ filter: 'failed' });
        await act(async () => last('rows').resolve(rowsReply(['f1'], 1)));
        expect(screen.queryByRole('alert')).toBeNull();
        expect(shownRows()).toEqual(['f1']);
    });

    it('shows no failure for the next filter after a retry succeeded', async () => {
        const { last } = mockCalls();
        renderSlot();
        await act(async () => last('screen').resolve(screenReply(7)));
        fireEvent.click(screen.getByRole('button', { name: /Failed/ }));
        await act(async () => last('rows').reject(new Error('down')));
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
        await act(async () => last('rows').resolve(rowsReply(['f1'], 1)));
        expect(screen.queryByRole('alert')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: /Succeeded/ }));
        expect(last('rows').query).toMatchObject({ filter: 'succeeded' });
        expect(screen.getByText('Loading rows… · Succeeded')).toBeInTheDocument();
        expect(screen.queryByRole('alert')).toBeNull();
        expect(screen.queryByRole('button', { name: /Try/ })).toBeNull();
    });

    it('keeps a page above 10000 in memory with its filter and search, and puts page 10000 back in the address', async () => {
        const { last } = mockCalls();
        renderSlot({ search: '?deploys.filter=failed&deploys.q=pay&deploys.page=9999' });
        await act(async () => last('screen').resolve(screenReply(7)));
        expect(last('rows').query).toMatchObject({ filter: 'failed', q: 'pay', page: '9999' });
        // 10002 pages of 3 rows.
        await act(async () => last('rows').resolve(rowsReply(['p1'], 30006)));

        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        expect(last('rows').query).toMatchObject({ filter: 'failed', q: 'pay', page: '10000' });
        expect(address().get('deploys.page')).toBe('10000');
        expect(screen.queryByText(OVERFLOW_NOTICE)).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        expect(last('rows').query).toMatchObject({ filter: 'failed', q: 'pay', page: '10001' });
        expect(screen.getByText('Page 10001 of 10002')).toBeInTheDocument();
        expect(screen.getByText(OVERFLOW_NOTICE)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Failed/ })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('searchbox', { name: 'Filter deployments' })).toHaveValue('pay');
        // The address has no key of the table, so it never shows filters that the table does not use.
        expect([...address().keys()].filter((key) => key.startsWith('deploys.'))).toEqual([]);

        fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
        expect(last('rows').query).toMatchObject({ filter: 'failed', q: 'pay', page: '10000' });
        expect(screen.queryByText(OVERFLOW_NOTICE)).toBeNull();
        expect(address().toString()).toBe('deploys.filter=failed&deploys.q=pay&deploys.page=10000');
    });

    it.each([
        ['a route that is not read-only', 'unsafe'],
        ['an unknown route', 'missing'],
    ])('does not call %s', async (_, source) => {
        const { last, pending } = mockCalls();
        renderSlot();
        await act(async () => last('screen').resolve(screenReply(7, source)));
        expect(screen.getByRole('alert')).toHaveTextContent('Table source route unavailable.');
        expect(pending(source)).toHaveLength(0);
        expect(screen.queryByText('inline-only')).toBeNull();
    });
});

describe('a page request that is too long for CALM Hub', () => {
    const TOO_LONG = 'The search is too long to send to the extension. Shorten it to load the rows.';
    const searchbox = () => screen.getByRole('searchbox', { name: 'Filter deployments' });

    it('sends a search that fills the request line, and keeps a longer search without sending it', async () => {
        const { last, pending } = mockCalls();
        renderSlot({ context: longContext });
        await act(async () => last('screen').resolve(screenReply(7)));
        await act(async () => last('rows').resolve(rowsReply(['d1', 'd2', 'd3'], 45)));

        const fills = searchForLine(4096);
        fireEvent.change(searchbox(), { target: { value: fills } });
        await typingStops();
        expect(last('rows').query).toMatchObject({ ...longContext, q: fills, page: '1' });
        expect(requestLine(last('rows').query)).toHaveLength(4096);
        await act(async () => last('rows').resolve(rowsReply(['m1'], 1)));
        expect(shownRows()).toEqual(['m1']);
        expect(searchbox()).not.toHaveAttribute('aria-invalid');

        const over = searchForLine(4097);
        fireEvent.change(searchbox(), { target: { value: over } });
        await typingStops();
        expect(pending('rows')).toHaveLength(2);
        expect(screen.getByRole('alert')).toHaveTextContent(TOO_LONG);
        expect(searchbox()).toHaveValue(over);
        expect(searchbox()).toHaveAttribute('aria-invalid', 'true');
        expect(searchbox()).toHaveAccessibleDescription(TOO_LONG);
        expect(address().get('deploys.q')).toBe(over);
        // The rows of the earlier search do not show under this one.
        expect(screen.queryByRole('table')).toBeNull();
        expect(screen.getByText(`No rows loaded · “${over}”`)).toBeInTheDocument();

        fireEvent.change(searchbox(), { target: { value: 'pay' } });
        await typingStops();
        expect(last('rows').query).toMatchObject({ q: 'pay', page: '1' });
        await act(async () => last('rows').resolve(rowsReply(['p1'], 1)));
        expect(shownRows()).toEqual(['p1']);
        expect(screen.queryByRole('alert')).toBeNull();
        expect(searchbox()).not.toHaveAttribute('aria-invalid');
    });

    it('counts the tile filter, and loads the rows when a tile or Clear filters makes the request fit', async () => {
        const { last, pending } = mockCalls();
        // Without the filter the request line is 4090 characters; `&filter=failed` makes it 4104.
        const q = searchForLine(4090);
        renderSlot({ context: longContext, search: `?deploys.filter=failed&deploys.q=${encodeURIComponent(q)}` });
        await act(async () => last('screen').resolve(screenReply(7)));
        expect(pending('rows')).toHaveLength(0);
        expect(screen.getByRole('alert')).toHaveTextContent(TOO_LONG);
        expect(searchbox()).toHaveValue(q);
        expect(screen.getByRole('button', { name: /Failed/ })).toHaveAttribute('aria-pressed', 'true');

        fireEvent.click(screen.getByRole('button', { name: /All deployments/ }));
        expect(last('rows').query).toMatchObject({ q, page: '1' });
        expect(last('rows').query.filter).toBeUndefined();
        await act(async () => last('rows').resolve(rowsReply(['a1'], 1)));
        expect(shownRows()).toEqual(['a1']);
        expect(screen.queryByRole('alert')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: /Failed/ }));
        expect(pending('rows')).toHaveLength(1);
        expect(screen.getByRole('alert')).toHaveTextContent(TOO_LONG);
        expect(screen.queryByRole('table')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
        expect(last('rows').query).toMatchObject({ page: '1' });
        expect(last('rows').query.q).toBeUndefined();
        expect(last('rows').query.filter).toBeUndefined();
        expect(screen.queryByRole('alert')).toBeNull();
        expect(searchbox()).toHaveValue('');
    });

    it('sends the longest search that the page address keeps', async () => {
        const { last } = mockCalls();
        const longest = '𝄞'.repeat(SCREEN_STATE_LIMITS.tableQuery);
        renderSlot({ search: `?deploys.q=${encodeURIComponent(longest)}` });
        await act(async () => last('screen').resolve(screenReply(7)));
        expect(last('rows').query.q).toBe(longest);
        expect(screen.queryByRole('alert')).toBeNull();
    });
});

describe('refresh after a confirmed write', () => {
    // Two source tables with different saved searches, so that a search box that moves to the other table shows.
    const twoTables = (first: 'deploys' | 'builds'): { hubApi: number; blocks: ScreenBlock[] } => {
        const table = (id: string, label: string, source: string): ScreenBlock => ({
            type: 'table',
            id,
            columns: ['Name', 'Result'],
            rows: [],
            search: { label },
            source: { route: source, pageSize: 3 },
        });
        const tables = [table('deploys', 'Filter deployments', 'rows'), table('builds', 'Filter builds', 'builds')];
        return { hubApi: 0, blocks: first === 'deploys' ? tables : tables.reverse() };
    };

    it('keeps each search with its table when the new reply has the tables in another order', async () => {
        const { last } = mockCalls();
        renderSlot({ search: '?deploys.q=pay&builds.q=ci' });
        await act(async () => last('screen').resolve(twoTables('deploys')));
        const deployments = () => screen.getByRole('searchbox', { name: 'Filter deployments' });
        const builds = () => screen.getByRole('searchbox', { name: 'Filter builds' });
        expect(deployments()).toHaveValue('pay');
        expect(builds()).toHaveValue('ci');
        // Text that the box has not sent yet.
        fireEvent.change(builds(), { target: { value: 'nightly' } });

        fireEvent.click(screen.getByRole('button', { name: 'Refresh delivery' }));
        await act(async () => last('screen').resolve(twoTables('builds')));
        await typingStops();

        expect(screen.getAllByRole('searchbox').map((box) => box.getAttribute('placeholder'))).toEqual([
            'Filter builds',
            'Filter deployments',
        ]);
        expect(deployments()).toHaveValue('pay');
        expect(builds()).toHaveValue('nightly');
        expect(address().get('deploys.q')).toBe('pay');
        expect(address().get('builds.q')).toBe('nightly');
        expect(last('rows').query.q).toBe('pay');
        expect(last('builds').query.q).toBe('nightly');
    });

    it('reloads the slot and its table in place, with the same filters', async () => {
        const { last, pending } = mockCalls();
        renderSlot({ withAction: true });
        await act(async () => last('screen').resolve(screenReply(7)));
        fireEvent.click(screen.getByRole('button', { name: /Failed/ }));
        await act(async () => last('rows').resolve(rowsReply(['f1', 'f2'], 7)));

        fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
        fireEvent.click(screen.getByRole('button', { name: 'Run' }));
        await act(async () => last('write').resolve({ ok: true }));

        expect(pending('screen')).toHaveLength(2);
        expect(last('rows').query).toMatchObject({ filter: 'failed', page: '1' });
        // The earlier reply stays while the slot loads again.
        expect(screen.getByRole('button', { name: /Failed/ })).toHaveTextContent('7');
        expect(shownRows()).toEqual(['f1', 'f2']);
        expect(screen.getByText('Refreshing…')).toBeInTheDocument();

        await act(async () => last('screen').resolve(screenReply(6)));
        await act(async () => last('rows').resolve(rowsReply(['f2'], 6)));
        expect(screen.getByRole('button', { name: /Failed/ })).toHaveTextContent('6');
        expect(screen.getByRole('button', { name: /Failed/ })).toHaveAttribute('aria-pressed', 'true');
        expect(shownRows()).toEqual(['f2']);
    });

    it('does not reload after a failed write', async () => {
        const { last, pending } = mockCalls();
        renderSlot({ withAction: true });
        await act(async () => last('screen').resolve(screenReply(7)));
        await act(async () => last('rows').resolve(rowsReply(['d1'], 45)));
        fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
        fireEvent.click(screen.getByRole('button', { name: 'Run' }));
        await act(async () => last('write').reject(new Error('refused')));
        expect(pending('screen')).toHaveLength(1);
        expect(pending('rows')).toHaveLength(1);
    });

    it('keeps the earlier data and the filters when a refresh fails, and tries again', async () => {
        const { last } = mockCalls();
        renderSlot();
        await act(async () => last('screen').resolve(screenReply(7)));
        fireEvent.click(screen.getByRole('button', { name: /Failed/ }));
        await act(async () => last('rows').resolve(rowsReply(['f1', 'f2'], 7)));

        fireEvent.click(screen.getByRole('button', { name: 'Refresh delivery' }));
        await act(async () => last('screen').reject(new Error('down')));
        await act(async () => last('rows').reject(new Error('down')));
        const alerts = screen.getAllByRole('alert').map((alert) => alert.textContent);
        expect(alerts).toEqual([
            expect.stringContaining('Could not refresh. This shows the data from before.'),
            expect.stringContaining('Could not refresh the rows. This shows the rows from before.'),
        ]);
        expect(screen.getByRole('button', { name: /Failed/ })).toHaveAttribute('aria-pressed', 'true');
        expect(shownRows()).toEqual(['f1', 'f2']);

        fireEvent.click(screen.getAllByRole('button', { name: 'Try again' })[0]);
        await act(async () => last('screen').resolve(screenReply(5)));
        expect(screen.getByRole('button', { name: /Failed/ })).toHaveTextContent('5');
        expect(screen.getAllByRole('alert')).toHaveLength(1);
    });
});
