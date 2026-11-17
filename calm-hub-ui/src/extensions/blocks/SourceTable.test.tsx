import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExtensionRoute, ExtensionSummary, ScreenBlock } from '../../model/extensions.js';
import { ExtensionQuery, ExtensionService } from '../../service/extension-service.js';
import { ExtensionSlot } from '../ExtensionSlot.js';
import { ExtensionsProvider } from '../ExtensionsContext.js';
import { useExtensionRefresh } from '../extensionRefresh.js';
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
    routes: [route('screen'), route('rows'), route('write', 'POST', false), route('unsafe', 'GET', false)],
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

function renderSlot(withAction = false) {
    const service = new ExtensionService();
    vi.spyOn(service, 'fetchExtensions').mockReturnValue(new Promise(() => {}));
    return render(
        <ExtensionsProvider service={service}>
            <MemoryRouter initialEntries={['/screen']}>
                <UrlTableState>
                    <ExtensionSlot extension={extension} contribution={contribution} headingLevel={1} />
                </UrlTableState>
                {withAction && <ExtensionSlot action placement="test" extension={extension} contribution={action} />}
                <RefreshButton />
            </MemoryRouter>
        </ExtensionsProvider>
    );
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

describe('refresh after a confirmed write', () => {
    it('reloads the slot and its table in place, with the same filters', async () => {
        const { last, pending } = mockCalls();
        renderSlot(true);
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
        renderSlot(true);
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
