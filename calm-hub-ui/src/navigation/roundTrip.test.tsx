import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ExtensionsContext } from '../extensions/ExtensionsContext.js';
import { ExtensionScreenPage } from '../extensions/ExtensionScreenPage.js';
import { ReturnBar } from '../hub/components/return-bar/ReturnBar.js';
import { RESOURCE_ROUTE, SCREEN_ROUTE } from '../hub/routes.js';
import type { ExtensionSummary } from '../model/extensions.js';
import { ExtensionService } from '../service/extension-service.js';
import { SCREEN_STATE_LIMITS } from './destinations.js';
import { DestinationLink } from './DestinationLink.js';
import { ReturnPointProvider } from './ReturnPointProvider.js';
import { ReturnLink } from './ReturnLink.js';
import { isExactVersion } from './returnPoints.js';

vi.mock('../components/navbar/Navbar.js', () => ({ Navbar: () => <nav>Navbar</nav> }));

const ASSURANCE: ExtensionSummary = {
    id: 'assurance',
    name: 'Assurance',
    hubApi: 0,
    routes: [{ id: 'list', method: 'GET', path: '/reviews', scope: 'authenticated', readOnly: true }],
    contributes: { screen: [{ id: 'reviews', title: 'Architecture reviews', route: 'list' }] },
};

// Two namespaces hold an architecture with the same id.
const REVIEWS = {
    hubApi: 0,
    blocks: [
        {
            type: 'table',
            columns: ['Architecture'],
            rows: [
                [
                    {
                        label: 'Payments platform',
                        hub: {
                            namespace: 'northstar.payments',
                            type: 'architectures',
                            id: 'payments',
                            version: '2.4.0',
                            element: 'payments-api',
                        },
                    },
                ],
                [
                    {
                        label: 'Treasury payments',
                        hub: { namespace: 'northstar.treasury', type: 'architectures', id: 'payments', version: '1.0.0' },
                    },
                ],
            ],
        },
        { type: 'links', items: [{ label: 'Due soon', screen: { extension: 'assurance', screen: 'reviews', params: { sort: 'soon' } } }] },
    ],
};

// Stands in for Hub's resource page: the same provider and return bar, and a link to the screen for this resource.
function ResourcePage() {
    const { namespace = '', type = '', id = '', version = '' } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    return (
        <ReturnPointProvider page={{ kind: 'resource', namespace, type, id, version }} label={`${id} ${version}`}>
            <ReturnBar notices={[]} />
            <p data-testid="resource">{`${location.pathname}${location.search}`}</p>
            <p data-testid="exact-version">{String(isExactVersion(location))}</p>
            <DestinationLink
                destination={{
                    screen: { extension: 'assurance', screen: 'reviews', context: { namespace, type, id, version, element: 'ledger' } },
                }}
            >
                Open reviews
            </DestinationLink>
            <button onClick={() => navigate(-1)}>Browser back</button>
            <button onClick={() => navigate(1)}>Browser forward</button>
        </ReturnPointProvider>
    );
}

function ScreenProbe() {
    const location = useLocation();
    const navigate = useNavigate();
    return (
        <>
            <p data-testid="screen-url">{`${location.pathname}${location.search}`}</p>
            <button onClick={() => navigate(-1)}>Browser back</button>
            <button onClick={() => navigate(1)}>Browser forward</button>
        </>
    );
}

const renderAt = (entry: string) =>
    render(
        <ExtensionsContext.Provider value={[ASSURANCE]}>
            <MemoryRouter initialEntries={[entry]}>
                <Routes>
                    <Route
                        path={SCREEN_ROUTE}
                        element={
                            <>
                                <ExtensionScreenPage />
                                <ScreenProbe />
                            </>
                        }
                    />
                    <Route path={RESOURCE_ROUTE} element={<ResourcePage />} />
                </Routes>
            </MemoryRouter>
        </ExtensionsContext.Provider>
    );

let call: ReturnType<typeof vi.fn<ExtensionService['call']>>;
beforeEach(() => {
    call = vi.fn<ExtensionService['call']>().mockResolvedValue(REVIEWS);
    vi.spyOn(ExtensionService.prototype, 'call').mockImplementation(call);
});
afterEach(() => vi.restoreAllMocks());

const LIST = '/extensions/assurance/reviews?sort=due&reviews.filter=needs-review&reviews.page=2';

it('goes from a filtered list to the exact architecture and node, and back to the same list state', async () => {
    renderAt(LIST);
    expect(call.mock.calls[0][2]).toEqual(expect.objectContaining({ sort: 'due' }));
    // Table keys stay in the browser.
    expect(call.mock.calls[0][2]).not.toHaveProperty('reviews.filter');

    fireEvent.click(await screen.findByRole('link', { name: 'Payments platform' }));
    expect(screen.getByTestId('resource')).toHaveTextContent(
        /^\/northstar\.payments\/architectures\/payments\/2\.4\.0\?node=payments-api&exact=1$/
    );

    fireEvent.click(screen.getByRole('link', { name: 'Back to Architecture reviews' }));
    expect(screen.getByTestId('screen-url')).toHaveTextContent(LIST);
    // No return link after the return: the stack is empty again.
    expect(screen.queryByRole('link', { name: /^Back to/ })).not.toBeInTheDocument();

    // Browser Back and Forward keep each entry's return point.
    fireEvent.click(screen.getByRole('button', { name: 'Browser back' }));
    expect(screen.getByRole('link', { name: 'Back to Architecture reviews' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Browser forward' }));
    expect(screen.getByTestId('screen-url')).toHaveTextContent(LIST);
});

it('opens the other namespace for the same id', async () => {
    renderAt(LIST);
    fireEvent.click(await screen.findByRole('link', { name: 'Treasury payments' }));
    expect(screen.getByTestId('resource')).toHaveTextContent('/northstar.treasury/architectures/payments/1.0.0');
});

it('goes from an architecture to its extension screen with its context, and back to the architecture', async () => {
    renderAt('/northstar.payments/architectures/payments/2.4.0?node=payments-api&tab=extensions');
    fireEvent.click(screen.getByRole('link', { name: 'Open reviews' }));

    await screen.findByRole('link', { name: 'Payments platform' });
    expect(call.mock.calls[0][2]).toEqual({
        namespace: 'northstar.payments',
        resource: 'architectures/payments',
        resourceType: 'architectures',
        resourceId: 'payments',
        version: '2.4.0',
        selectedElement: 'ledger',
    });
    expect(screen.getByText('northstar.payments/architectures/payments@2.4.0')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'Back to payments 2.4.0' }));
    expect(screen.getByTestId('resource')).toHaveTextContent(
        /^\/northstar\.payments\/architectures\/payments\/2\.4\.0\?node=payments-api&tab=extensions&exact=1$/
    );
});

it('keeps the way back, and adds none, when a link changes only the view of the same page', async () => {
    renderAt('/northstar.payments/architectures/payments/2.4.0?node=payments-api');
    fireEvent.click(screen.getByRole('link', { name: 'Open reviews' }));
    fireEvent.click(await screen.findByRole('link', { name: 'Due soon' }));
    await waitFor(() => expect(screen.getByTestId('screen-url')).toHaveTextContent('sort=soon'));
    expect(screen.queryByRole('link', { name: 'Back to Architecture reviews' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Back to payments 2.4.0' }));
    expect(screen.getByTestId('resource')).toHaveTextContent(
        /^\/northstar\.payments\/architectures\/payments\/2\.4\.0\?node=payments-api&exact=1$/
    );
});

// A timeline moves a landing on the latest version to its current moment, unless the navigation names the version.
it('opens the exact version that a Hub link or a return link names', async () => {
    renderAt(LIST);
    fireEvent.click(await screen.findByRole('link', { name: 'Payments platform' }));
    expect(screen.getByTestId('exact-version')).toHaveTextContent('true');

    fireEvent.click(screen.getByRole('link', { name: 'Open reviews' }));
    fireEvent.click(await screen.findByRole('link', { name: 'Back to payments 2.4.0' }));
    expect(screen.getByTestId('resource')).toHaveTextContent(
        /^\/northstar\.payments\/architectures\/payments\/2\.4\.0\?node=payments-api&exact=1$/
    );
    expect(screen.getByTestId('exact-version')).toHaveTextContent('true');
});

it('keeps the way back from a page with a long title, and shortens the title', () => {
    const title = '𝄞'.repeat(250);
    render(
        <MemoryRouter initialEntries={['/source?sort=due']}>
            <Routes>
                <Route
                    path="/extensions/:extension/:screen"
                    element={
                        <ReturnPointProvider page={{ kind: 'screen', extension: 'reviews', screen: 'list' }} label={title}>
                            <DestinationLink destination={{ screen: { extension: 'reviews', screen: 'details' } }}>
                                Open details
                            </DestinationLink>
                            <ReturnLink />
                        </ReturnPointProvider>
                    }
                />
                <Route path="/source" element={<Navigate to="/extensions/reviews/list?sort=due" />} />
            </Routes>
        </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('link', { name: 'Open details' }));
    // 199 characters and an ellipsis: 200 characters, counted as the URL limits count them.
    expect(screen.getByRole('link', { name: `Back to ${'𝄞'.repeat(199)}…` })).toHaveAttribute('href', '/extensions/reviews/list?sort=due');
});

it('explains an incomplete context and does not call the screen', () => {
    renderAt('/extensions/assurance/reviews?namespace=n&resourceId=1');
    expect(screen.getByRole('alert')).toHaveTextContent('incomplete or invalid resource');
    expect(call).not.toHaveBeenCalled();
});

it('explains a disabled extension, with the way back', () => {
    render(
        <ExtensionsContext.Provider value={[]}>
            <MemoryRouter
                initialEntries={[
                    {
                        pathname: '/extensions/assurance/reviews',
                        state: { returnTo: [{ page: { kind: 'chat' }, search: '', label: 'chat' }] },
                    },
                ]}
            >
                <Routes>
                    <Route path={SCREEN_ROUTE} element={<ExtensionScreenPage />} />
                </Routes>
            </MemoryRouter>
        </ExtensionsContext.Provider>
    );
    expect(screen.getByText(/"assurance" is not enabled in this Hub/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to chat' })).toHaveAttribute('href', '/chat');
});

it('does not load the screen again when only table state changes', async () => {
    function Filter() {
        const navigate = useNavigate();
        const location = useLocation();
        return (
            <button onClick={() => navigate(`${location.pathname}?sort=due&reviews.page=3`, { replace: true, state: location.state })}>
                Next page
            </button>
        );
    }
    render(
        <ExtensionsContext.Provider value={[ASSURANCE]}>
            <MemoryRouter initialEntries={[LIST]}>
                <Routes>
                    <Route
                        path={SCREEN_ROUTE}
                        element={
                            <>
                                <ExtensionScreenPage />
                                <Filter />
                            </>
                        }
                    />
                </Routes>
            </MemoryRouter>
        </ExtensionsContext.Provider>
    );
    await screen.findByRole('link', { name: 'Payments platform' });
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByRole('link', { name: 'Payments platform' })).toBeInTheDocument();
    expect(call).toHaveBeenCalledTimes(1);
});

it('keeps the longest valid screen state, percent-encoded, through the round trip', async () => {
    const { routeQuery, tableKeys, tableQuery } = SCREEN_STATE_LIMITS;
    // '界' is three UTF-8 bytes, so it takes nine characters in a URL. "a=" and 227 of them fill the route query.
    const query = new URLSearchParams({ a: '界'.repeat(Math.floor((routeQuery - 2) / 9)) });
    for (let table = 0; table < tableKeys; table++)
        query.set(`${String.fromCharCode(97 + table)}${'x'.repeat(63)}.q`, '界'.repeat(tableQuery));
    const list = `/extensions/assurance/reviews?${query}`;
    expect(list.length).toBeGreaterThan(24_000);

    renderAt(list);
    expect(call.mock.calls[0][2]).toEqual(expect.objectContaining({ a: '界'.repeat(227) }));
    fireEvent.click(await screen.findByRole('link', { name: 'Payments platform' }));
    fireEvent.click(screen.getByRole('link', { name: 'Back to Architecture reviews' }));
    expect(screen.getByTestId('screen-url')).toHaveTextContent(list);
});
