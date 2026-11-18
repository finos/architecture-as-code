import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createRef, ReactNode, Ref, useImperativeHandle, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import {
    createPath,
    Link,
    Location,
    MemoryRouter,
    NavigationType,
    Navigator,
    parsePath,
    Route,
    Router,
    Routes,
    To,
    useLocation,
    useNavigate,
    useNavigationType,
    useParams,
} from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExtensionScreen, ExtensionSummary, ScreenBlock } from '../../model/extensions.js';
import { ExtensionService } from '../../service/extension-service.js';
import { ExtensionSlot } from '../ExtensionSlot.js';
import { SCREEN_STATE_LIMITS } from '../../navigation/destinations.js';
import { UrlTableState, useTableStateStore } from './BlockScope.js';

const extension: ExtensionSummary = {
    id: 'assurance',
    name: 'Assurance',
    hubApi: 0,
    routes: [{ id: 'screen', method: 'GET', path: '/screen', scope: 'authenticated', readOnly: true }],
    contributes: {},
};
const contribution = { id: 'reviews', title: 'Architecture reviews', route: 'screen' };

const status = (badge: string) => ({ badge, tone: 'warning' as const });
// Uneven categories (2, 1, 3), so a tile that selects the wrong status shows a different set of rows.
const rows = [
    [
        { label: 'Payments platform', hub: { namespace: 'northstar', type: 'architectures', id: '1', version: '1.0.0' } },
        'Payments',
        status('Needs review'),
    ],
    ['Treasury settlement', 'Treasury', status('Needs review')],
    ['Card issuing', 'Cards', status('In review')],
    ['Ledger core', 'Payments', status('Approved')],
    ['Customer portal', 'Digital', status('Approved')],
    ['Fraud scoring', 'Risk', status('Approved')],
];
const tile = (label: string, value: number, id?: string) => ({
    label,
    value,
    filter: id ? { table: 'reviews', id, column: 'Status', value: label } : { table: 'reviews' },
});
const blocks: ScreenBlock[] = [
    {
        type: 'stats',
        items: [
            tile('All architectures', 6),
            tile('Needs review', 2, 'needs-review'),
            tile('In review', 1, 'in-review'),
            tile('Approved', 3, 'approved'),
            { label: 'Mean age', value: '4 days' },
            { label: 'Exceptions', value: 9, filter: { table: 'missing', id: 'open' } },
        ],
    },
    {
        type: 'table',
        id: 'reviews',
        columns: ['Architecture', 'Owner', 'Status'],
        rows,
        search: { label: 'Filter by name or owner', columns: ['Architecture', 'Owner'] },
    },
];
const reply: ExtensionScreen = { hubApi: 0, blocks };

afterEach(() => vi.restoreAllMocks());

function Probe() {
    const location = useLocation();
    const type = useNavigationType();
    const navigate = useNavigate();
    return (
        <>
            <output data-testid="search">{location.search}</output>
            <output data-testid="state">{JSON.stringify(location.state)}</output>
            <output data-testid="navigation">{type}</output>
            <button onClick={() => navigate(-1)}>Back</button>
        </>
    );
}

interface LaggingRouterHandle {
    show(location: Location, type?: NavigationType): void;
}

/**
 * A router that shows a navigation only when the test calls `show`, as a router that shows it in a transition can show
 * it late. Like a router, it shows a write of the page as a replace or a push. Another location is a Back (`POP`)
 * unless the test gives its type.
 */
function LaggingRouter({ ref, writes, children }: { ref: Ref<LaggingRouterHandle>; writes: Location[]; children: ReactNode }) {
    const [shown, setShown] = useState({
        location: { pathname: '/screen', search: '', hash: '', state: null, key: 'start' } as Location,
        type: NavigationType.Pop,
    });
    const types = useMemo(() => new WeakMap<Location, NavigationType>(), []);
    useImperativeHandle(
        ref,
        () => ({ show: (location, type) => setShown({ location, type: type ?? types.get(location) ?? NavigationType.Pop }) }),
        [types]
    );
    const navigator = useMemo<Navigator>(() => {
        const write = (type: NavigationType) => (to: To, state: unknown) => {
            const location: Location = {
                pathname: '/screen',
                search: '',
                hash: '',
                ...(typeof to === 'string' ? parsePath(to) : to),
                state,
                key: `${writes.length}`,
            };
            types.set(location, type);
            writes.push(location);
        };
        return {
            createHref: (to) => (typeof to === 'string' ? to : createPath(to)),
            go: () => {},
            push: write(NavigationType.Push),
            replace: write(NavigationType.Replace),
        };
    }, [writes, types]);
    return (
        <Router location={shown.location} navigationType={shown.type} navigator={navigator}>
            {children}
        </Router>
    );
}

/** Renders the screen under a `LaggingRouter`. `newest` is the query of the latest write, which the page can show later. */
function renderLagging(screenReply: ExtensionScreen = reply) {
    vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue(screenReply);
    const router = createRef<LaggingRouterHandle>();
    const writes: Location[] = [];
    render(
        <LaggingRouter ref={router} writes={writes}>
            <UrlTableState>
                <ExtensionSlot extension={extension} contribution={contribution} headingLevel={1} />
            </UrlTableState>
        </LaggingRouter>
    );
    return {
        writes,
        newest: () => writes.at(-1)?.search,
        show: (location: Location, type?: NavigationType) => act(() => router.current!.show(location, type)),
    };
}

function renderScreen(search = '', screenReply = reply) {
    vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue(screenReply);
    return render(
        <MemoryRouter initialEntries={['/', { pathname: '/screen', search, state: { breadcrumbs: ['home'] } }]} initialIndex={1}>
            <Routes>
                <Route
                    path="/screen"
                    element={
                        <UrlTableState>
                            <ExtensionSlot extension={extension} contribution={contribution} headingLevel={1} />
                        </UrlTableState>
                    }
                />
                <Route path="*" element={<p>Architecture page</p>} />
            </Routes>
            <Probe />
        </MemoryRouter>
    );
}

const tileButton = (name: RegExp) => screen.getByRole('button', { name });
const shownRows = () =>
    within(screen.getByRole('table'))
        .getAllByRole('row')
        .slice(1)
        .map((row) => within(row).getAllByRole('cell')[0].textContent);
const summary = () =>
    within(screen.getByRole('region', { name: 'Architecture reviews' }))
        .getAllByRole('status')
        .map((s) => s.textContent)
        .join('|');

describe('stat tiles that filter a table', () => {
    it('shows the rows of the selected tile, and keeps the tile figures for the whole dataset', async () => {
        renderScreen();
        fireEvent.click(await screen.findByRole('button', { name: /Needs review/ }));

        expect(shownRows()).toEqual(['Payments platform', 'Treasury settlement']);
        expect(tileButton(/Needs review/)).toHaveAttribute('aria-pressed', 'true');
        expect(tileButton(/All architectures/)).toHaveAttribute('aria-pressed', 'false');
        expect(summary()).toContain('2 of 6 rows · Needs review');

        fireEvent.click(tileButton(/Approved/));
        expect(shownRows()).toEqual(['Ledger core', 'Customer portal', 'Fraud scoring']);
        fireEvent.click(tileButton(/In review/));
        expect(shownRows()).toEqual(['Card issuing']);
        expect(tileButton(/Approved/)).toHaveTextContent('3');
    });

    it('shows all rows when the selected tile is pressed again, or the tile without a filter id', async () => {
        renderScreen();
        fireEvent.click(await screen.findByRole('button', { name: /Approved/ }));
        fireEvent.click(tileButton(/Approved/));
        expect(shownRows()).toHaveLength(6);
        expect(tileButton(/All architectures/)).toHaveAttribute('aria-pressed', 'true');

        fireEvent.click(tileButton(/Approved/));
        fireEvent.click(tileButton(/All architectures/));
        expect(shownRows()).toHaveLength(6);
    });

    it('keeps tiles without a usable filter as figures', async () => {
        renderScreen();
        await screen.findByRole('button', { name: /Needs review/ });
        expect(screen.queryByRole('button', { name: /Mean age/ })).toBeNull();
        expect(screen.queryByRole('button', { name: /Exceptions/ })).toBeNull();
        expect(screen.getByText('Exceptions')).toBeInTheDocument();
    });

    it('combines a tile filter with the search text, and clears both', async () => {
        renderScreen();
        fireEvent.click(await screen.findByRole('button', { name: /Needs review/ }));
        const search = screen.getByRole('searchbox', { name: 'Filter by name or owner' });
        fireEvent.change(search, { target: { value: 'pay' } });

        // Both filters apply: "pay" alone matches Payments platform and Ledger core.
        await waitFor(() => expect(shownRows()).toEqual(['Payments platform']));
        expect(summary()).toContain('1 of 6 rows · Needs review · “pay”');
        expect(tileButton(/Approved/)).toHaveTextContent('3');

        fireEvent.click(tileButton(/All architectures/));
        expect(shownRows()).toEqual(['Payments platform', 'Ledger core']);

        fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
        expect(shownRows()).toHaveLength(6);
        expect(search).toHaveValue('');
        expect(search).toHaveFocus();
        expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
    });

    it('searches only the columns that the search names', async () => {
        renderScreen();
        fireEvent.change(await screen.findByRole('searchbox'), { target: { value: 'review' } });
        await waitFor(() => expect(screen.getByText('No rows match these filters.')).toBeInTheDocument());
        expect(summary()).toContain('0 of 6 rows · “review”');
    });

    it('works from the keyboard', async () => {
        renderScreen();
        const needsReview = await screen.findByRole('button', { name: /Needs review/ });
        needsReview.focus();
        await userEvent.keyboard('{Enter}');
        expect(needsReview).toHaveAttribute('aria-pressed', 'true');
        await userEvent.keyboard(' ');
        expect(needsReview).toHaveAttribute('aria-pressed', 'false');
        expect(tileButton(/Needs review/)).toHaveAttribute('aria-controls', screen.getByRole('table').id);
    });
});

describe('filters in the screen URL', () => {
    it('writes the filters in place, keeps the history state, and restores them after Back from an architecture', async () => {
        renderScreen();
        fireEvent.click(await screen.findByRole('button', { name: /Needs review/ }));
        fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'pay' } });
        await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent('?reviews.filter=needs-review&reviews.q=pay'));
        expect(screen.getByTestId('navigation')).toHaveTextContent('REPLACE');
        expect(JSON.parse(screen.getByTestId('state').textContent!)).toMatchObject({ breadcrumbs: ['home'] });

        fireEvent.click(screen.getByRole('link', { name: 'Payments platform' }));
        expect(await screen.findByText('Architecture page')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Back' }));

        await waitFor(() => expect(shownRows()).toEqual(['Payments platform']));
        expect(tileButton(/Needs review/)).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('searchbox')).toHaveValue('pay');
        expect(JSON.parse(screen.getByTestId('state').textContent!)).toMatchObject({ breadcrumbs: ['home'] });
    });

    it('keeps each change that comes before the page shows the change before it', async () => {
        const exceptions: ScreenBlock[] = [
            {
                type: 'stats',
                items: [{ label: 'Open', value: 1, filter: { table: 'exceptions', id: 'open', column: 'State', value: 'Open' } }],
            },
            {
                type: 'table',
                id: 'exceptions',
                columns: ['Exception', 'State'],
                rows: [
                    ['EX-1', 'Open'],
                    ['EX-2', 'Closed'],
                ],
            },
        ];
        const { writes, newest, show } = renderLagging({ hubApi: 0, blocks: [...blocks, ...exceptions] });

        fireEvent.click(await screen.findByRole('button', { name: /Needs review/ }));
        fireEvent.click(tileButton(/In review/));
        fireEvent.click(tileButton(/Needs review/));
        fireEvent.click(tileButton(/Open/));
        expect(writes.map((write) => write.search)).toEqual([
            '?reviews.filter=needs-review',
            '?reviews.filter=in-review',
            '?reviews.filter=needs-review',
            '?reviews.filter=needs-review&exceptions.filter=open',
        ]);

        // The page shows the first two writes only. The first one has the same query as a later one.
        show(writes[0]);
        show(writes[1]);
        expect(tileButton(/Needs review/)).toHaveAttribute('aria-pressed', 'true');
        expect(tileButton(/Open/)).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(tileButton(/Needs review/));
        expect(newest()).toBe('?exceptions.filter=open');

        // After another navigation, a change starts from the query that the page shows.
        show({ pathname: '/screen', search: '?status=open', hash: '', state: null, key: 'link' }, NavigationType.Push);
        fireEvent.click(tileButton(/Approved/));
        expect(newest()).toBe('?status=open&reviews.filter=approved');
    });

    it('keeps newer search text when the page shows an earlier search late', async () => {
        const { writes, newest, show } = renderLagging();
        const box = await screen.findByRole('searchbox');
        for (const text of ['p', 'pa', 'p', 'pay']) {
            fireEvent.change(box, { target: { value: text } });
            await waitFor(() => expect(newest()).toBe(`?reviews.q=${text}`));
        }

        for (const write of writes) {
            show(write);
            expect(box).toHaveValue('pay');
        }
        show({ pathname: '/screen', search: '?reviews.q=ledger', hash: '', state: null, key: 'link' }, NavigationType.Push);
        expect(box).toHaveValue('ledger');
    });

    it('shows the filters of each address that the browser opens, though React Router gives each the same key', async () => {
        const { show } = renderLagging();
        const box = await screen.findByRole('searchbox');
        // An address typed in, or a link in the page, makes a location with the key `default`.
        show({ pathname: '/screen', search: '?reviews.filter=approved&reviews.q=ledger', hash: '', state: null, key: 'default' });
        expect(tileButton(/Approved/)).toHaveAttribute('aria-pressed', 'true');
        expect(box).toHaveValue('ledger');

        show({ pathname: '/screen', search: '', hash: '', state: null, key: 'default' });
        expect(tileButton(/Approved/)).toHaveAttribute('aria-pressed', 'false');
        expect(box).toHaveValue('');
    });

    // A replace on the page that is not a write of the store must win too: only the last change of a batch is a write.
    it.each(['a link', 'Back', 'a replace'])('shows the filters of %s after changes in one batch, though a change had its query', async (way) => {
        vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue(reply);
        function Replace() {
            const navigate = useNavigate();
            return <button onClick={() => navigate('/screen?reviews.filter=in-review', { replace: true })}>Replace</button>;
        }
        render(
            <MemoryRouter initialEntries={['/screen?reviews.filter=in-review', '/screen']} initialIndex={1}>
                <UrlTableState>
                    <ExtensionSlot extension={extension} contribution={contribution} headingLevel={1} />
                </UrlTableState>
                <Probe />
                <Link to="/screen?reviews.filter=in-review">Reviews in progress</Link>
                <Replace />
            </MemoryRouter>
        );
        const needsReview = await screen.findByRole('button', { name: /Needs review/ });
        act(() => {
            fireEvent.click(needsReview);
            fireEvent.click(tileButton(/In review/));
            fireEvent.click(needsReview);
        });
        expect(screen.getByTestId('search')).toHaveTextContent(/^\?reviews\.filter=needs-review$/);

        const control = {
            'a link': () => screen.getByRole('link', { name: 'Reviews in progress' }),
            Back: () => screen.getByRole('button', { name: 'Back' }),
            'a replace': () => screen.getByRole('button', { name: 'Replace' }),
        }[way]!;
        fireEvent.click(control());
        expect(screen.getByTestId('search')).toHaveTextContent(/^\?reviews\.filter=in-review$/);
        expect(tileButton(/In review/)).toHaveAttribute('aria-pressed', 'true');
        expect(shownRows()).toEqual(['Card issuing']);
    });

    it.each([NavigationType.Push, NavigationType.Pop])(
        'shows the filters of a %s navigation, though its query is that of a write that the page skipped',
        async (type) => {
            const { writes, show } = renderLagging();
            fireEvent.click(await screen.findByRole('button', { name: /Needs review/ }));
            fireEvent.click(tileButton(/In review/));
            fireEvent.click(tileButton(/Needs review/));
            expect(writes).toHaveLength(3);

            show(writes[2]);
            show({ pathname: '/screen', search: '?reviews.filter=in-review', hash: '', state: null, key: 'other' }, type);
            expect(tileButton(/In review/)).toHaveAttribute('aria-pressed', 'true');
        }
    );

    it.each([NavigationType.Push, NavigationType.Pop])(
        'shows the filters of a %s navigation carrying an unshown write ID',
        async (type) => {
            const { writes, show } = renderLagging();
            fireEvent.click(await screen.findByRole('button', { name: /Needs review/ }));
            fireEvent.click(tileButton(/In review/));
            expect(writes).toHaveLength(2);

            show({ ...writes[0], key: 'external' }, type);
            expect(tileButton(/Needs review/)).toHaveAttribute('aria-pressed', 'true');
            expect(shownRows()).toEqual(['Payments platform', 'Treasury settlement']);
        }
    );

    it('shows the filters of another page, though it has the query and history state of a write', async () => {
        const { writes, show } = renderLagging();
        fireEvent.click(await screen.findByRole('button', { name: /Needs review/ }));
        fireEvent.click(tileButton(/In review/));

        show({ ...writes[0], pathname: '/other', key: 'other' }, NavigationType.Replace);
        expect(tileButton(/Needs review/)).toHaveAttribute('aria-pressed', 'true');
    });

    it('shows the filters of a write of an earlier store, though it has the query of a write of this store', async () => {
        vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue(reply);
        const router = createRef<LaggingRouterHandle>();
        const writes: Location[] = [];
        const page = (store: number) => (
            <LaggingRouter ref={router} writes={writes}>
                <UrlTableState key={store}>
                    <ExtensionSlot extension={extension} contribution={contribution} headingLevel={1} />
                </UrlTableState>
            </LaggingRouter>
        );
        const { rerender } = render(page(1));
        fireEvent.click(await screen.findByRole('button', { name: /Needs review/ }));
        rerender(page(2));
        fireEvent.click(await screen.findByRole('button', { name: /Needs review/ }));
        fireEvent.click(tileButton(/In review/));
        expect(writes.map((write) => write.search)).toEqual([
            '?reviews.filter=needs-review',
            '?reviews.filter=needs-review',
            '?reviews.filter=in-review',
        ]);

        act(() => router.current!.show(writes[0], NavigationType.Replace));
        expect(tileButton(/Needs review/)).toHaveAttribute('aria-pressed', 'true');
    });

    it('reads the filters of a link, and ignores a filter that no tile declares', async () => {
        renderScreen('?reviews.filter=approved&reviews.q=ledger');
        await waitFor(() => expect(shownRows()).toEqual(['Ledger core']));

        fireEvent.click(tileButton(/All architectures/));
        expect(screen.getByTestId('search')).toHaveTextContent('?reviews.q=ledger');
    });

    it('ignores a key that the navigation contract refuses', async () => {
        renderScreen(`?reviews.filter=approved&reviews.q=${'l'.repeat(SCREEN_STATE_LIMITS.tableQuery + 1)}&reviews.page=02`);
        await waitFor(() => expect(shownRows()).toEqual(['Ledger core', 'Customer portal', 'Fraud scoring']));
        expect(screen.getByRole('searchbox')).toHaveValue('');
    });

    it('lets the search box hold as many characters as the page address keeps, and no more', async () => {
        // One character and two UTF-16 units. The address counts characters, as JSON Schema `maxLength` does.
        const clef = '\u{1D11E}';
        const longest = clef.repeat(SCREEN_STATE_LIMITS.tableQuery);
        renderScreen(`?reviews.q=${encodeURIComponent(longest)}`);
        const box = await screen.findByRole('searchbox');
        expect(box).toHaveValue(longest);

        const user = userEvent.setup();
        await user.clear(box);
        await user.paste(longest);
        expect(box).toHaveValue(longest);
        await waitFor(() => expect(new URLSearchParams(screen.getByTestId('search').textContent!).get('reviews.q')).toBe(longest));

        await user.clear(box);
        await user.paste(`x${longest}`);
        expect(box).toHaveValue(`x${clef.repeat(SCREEN_STATE_LIMITS.tableQuery - 1)}`);
    });

    it('shows all rows for an unknown filter id', async () => {
        renderScreen('?reviews.filter=rejected');
        await screen.findByRole('button', { name: /Needs review/ });
        expect(shownRows()).toHaveLength(6);
        expect(tileButton(/All architectures/)).toHaveAttribute('aria-pressed', 'true');
    });

    it('keeps the filters of a table in memory, and says so, when the URL has no room for them', async () => {
        const full = ['a', 'b', 'c', 'd'].flatMap((id) => [`${id}.filter=x`, `${id}.q=y`, `${id}.page=2`]).join('&');
        renderScreen(`?${full}`);
        fireEvent.click(await screen.findByRole('button', { name: /Needs review/ }));

        expect(shownRows()).toEqual(['Payments platform', 'Treasury settlement']);
        expect(screen.getByText('These filters are not kept in the page address.')).toBeInTheDocument();
        expect(screen.getByTestId('search')).toHaveTextContent(`?${full}`);

        // Two presses before the page shows the first: the second one undoes it.
        act(() => {
            fireEvent.click(tileButton(/Approved/));
            fireEvent.click(tileButton(/Approved/));
        });
        expect(screen.queryByText('These filters are not kept in the page address.')).toBeNull();
        expect(shownRows()).toHaveLength(6);
    });

    it('reads a table id that is also an Object property, such as constructor', async () => {
        renderScreen('?constructor.filter=approved', {
            hubApi: 0,
            blocks: blocks.map((block) =>
                block.type === 'table'
                    ? { ...block, id: 'constructor' }
                    : block.type === 'stats'
                      ? {
                            ...block,
                            items: block.items.map((item) =>
                                item.filter ? { ...item, filter: { ...item.filter, table: 'constructor' } } : item
                            ),
                        }
                      : block
            ),
        });
        expect(await screen.findByRole('button', { name: /Approved/ })).toHaveAttribute('aria-pressed', 'true');
        expect(shownRows()).toHaveLength(3);
        expect(screen.queryByText('These filters are not kept in the page address.')).toBeNull();
    });
});

describe('writes of the store', () => {
    function Controls() {
        const store = useTableStateStore('screen');
        const navigate = useNavigate();
        const location = useLocation();
        return (
            <>
                {['a', 'b'].map((filter) => (
                    <button key={filter} onClick={() => store.update('t', (previous) => ({ ...previous, filter }))}>
                        Choose {filter}
                    </button>
                ))}
                <button onClick={() => navigate('?t.filter=b', { replace: true })}>Replace with b</button>
                <output data-testid="filter">{store.get('t').filter}</output>
                <output data-testid="url">{location.search}</output>
            </>
        );
    }
    const renderControls = () =>
        render(
            <MemoryRouter>
                <UrlTableState>
                    <Controls />
                </UrlTableState>
            </MemoryRouter>
        );

    it('lets another replace on the page win after three writes, one of them with the same query', async () => {
        renderControls();
        act(() => {
            flushSync(() => fireEvent.click(screen.getByRole('button', { name: 'Choose a' })));
            flushSync(() => fireEvent.click(screen.getByRole('button', { name: 'Choose b' })));
            flushSync(() => fireEvent.click(screen.getByRole('button', { name: 'Choose a' })));
        });
        await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('?t.filter=a'));
        expect(screen.getByTestId('filter')).toHaveTextContent(/^a$/);
        fireEvent.click(screen.getByRole('button', { name: 'Replace with b' }));
        await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('?t.filter=b'));
        expect(screen.getByTestId('filter')).toHaveTextContent(/^b$/);
    });

    it('lets another replace on the page win while it has the query of a write that the page did not show', async () => {
        renderControls();
        act(() => {
            flushSync(() => fireEvent.click(screen.getByRole('button', { name: 'Choose b' })));
            flushSync(() => fireEvent.click(screen.getByRole('button', { name: 'Choose a' })));
            fireEvent.click(screen.getByRole('button', { name: 'Replace with b' }));
        });
        await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('?t.filter=b'));
        expect(screen.getByTestId('filter')).toHaveTextContent(/^b$/);
    });

    it('lets another replace on the page win when no write is waiting', async () => {
        renderControls();
        fireEvent.click(screen.getByRole('button', { name: 'Choose a' }));
        await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('?t.filter=a'));
        fireEvent.click(screen.getByRole('button', { name: 'Replace with b' }));
        await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('?t.filter=b'));
        expect(screen.getByTestId('filter')).toHaveTextContent(/^b$/);
    });
});

describe('filters that the URL has no room for', () => {
    const full = ['a', 'b', 'c', 'd'].flatMap((id) => [`${id}.filter=x`, `${id}.q=y`, `${id}.page=2`]).join('&');

    // One provider for every screen and context, as the screen route keeps its element mounted.
    function Page() {
        const { screenId } = useParams();
        const namespace = new URLSearchParams(useLocation().search).get('namespace') ?? undefined;
        return (
            <UrlTableState>
                <ExtensionSlot
                    extension={extension}
                    contribution={{ ...contribution, id: screenId! }}
                    context={{ namespace }}
                    headingLevel={1}
                />
            </UrlTableState>
        );
    }
    function Go({ to }: { to: string }) {
        const navigate = useNavigate();
        return <button onClick={() => navigate(to)}>Go</button>;
    }
    function renderAt(start: string, next: string) {
        vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue(reply);
        render(
            <MemoryRouter initialEntries={[start]}>
                <Routes>
                    <Route path="/s/:screenId" element={<Page />} />
                </Routes>
                <Go to={next} />
            </MemoryRouter>
        );
    }

    it.each([
        ['another screen with a table of the same id', `/s/reviews?${full}`, '/s/exceptions'],
        ['another resource context on the same screen', `/s/reviews?namespace=one&${full}`, `/s/reviews?namespace=two&${full}`],
    ])('do not follow the user to %s', async (_, start, next) => {
        renderAt(start, next);
        fireEvent.click(await screen.findByRole('button', { name: /Needs review/ }));
        expect(screen.getByText('These filters are not kept in the page address.')).toBeInTheDocument();
        expect(shownRows()).toHaveLength(2);

        fireEvent.click(screen.getByRole('button', { name: 'Go' }));
        await waitFor(() => expect(shownRows()).toHaveLength(6));
        expect(screen.getByRole('button', { name: /Needs review/ })).toHaveAttribute('aria-pressed', 'false');
        expect(screen.queryByText('These filters are not kept in the page address.')).toBeNull();
    });

    it('show the filters of a link to the same screen', async () => {
        renderAt(`/s/reviews?${full}`, '/s/reviews?reviews.filter=approved');
        fireEvent.click(await screen.findByRole('button', { name: /Needs review/ }));
        expect(screen.getByText('These filters are not kept in the page address.')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Go' }));
        expect(screen.getByRole('button', { name: /Approved/ })).toHaveAttribute('aria-pressed', 'true');
        expect(shownRows()).toHaveLength(3);
        expect(screen.queryByText('These filters are not kept in the page address.')).toBeNull();
    });
});

it('keeps the filters of a contextual slot in memory, not in the page URL', async () => {
    vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue(reply);
    render(
        <MemoryRouter initialEntries={['/northstar/architectures/1/1.0.0?tab=extensions']}>
            <ExtensionSlot extension={extension} contribution={contribution} context={{ namespace: 'northstar' }} headingLevel={4} />
            <Probe />
        </MemoryRouter>
    );
    fireEvent.click(await screen.findByRole('button', { name: /Approved/ }));
    expect(shownRows()).toHaveLength(3);
    expect(screen.getByTestId('search')).toHaveTextContent('?tab=extensions');

    // Two presses before the page shows the first: the second one undoes it.
    act(() => {
        fireEvent.click(tileButton(/In review/));
        fireEvent.click(tileButton(/In review/));
    });
    expect(shownRows()).toHaveLength(6);
    await act(async () => {});
});
