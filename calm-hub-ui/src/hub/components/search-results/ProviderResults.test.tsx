import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SearchResultsPage } from './SearchResultsPage.js';
import { MAX_PROVIDER_RESULTS } from './useProviderSearch.js';
import { ExtensionsContext, ExtensionsProvider } from '../../../extensions/ExtensionsContext.js';
import { ExtensionSearchError, ExtensionService } from '../../../service/extension-service.js';
import { SearchService } from '../../../service/search-service.js';
import type { ExtensionSummary } from '../../../model/extensions.js';
import type { ExtensionSearchPage, GroupedSearchResults } from '../../../model/search.js';
import { ReturnLink } from '../../../navigation/ReturnLink.js';
import { ReturnPointProvider } from '../../../navigation/ReturnPointProvider.js';
import { CalmService } from '../../../service/calm-service.js';
import { RESOURCE_ROUTE } from '../../routes.js';
import { fakeImageAssets, logoSvg, svgDataUrl } from '../../../test-support/fake-image-assets.js';

const catalogue: GroupedSearchResults = {
    architectures: [{ namespace: 'finos', id: 1, name: 'Payments platform', description: 'Card payments' }],
    patterns: [],
    flows: [],
    standards: [],
    interfaces: [],
    controls: [],
    adrs: [],
};

function provider(id: string, name: string, title: string): ExtensionSummary {
    return {
        id,
        name,
        hubApi: 0,
        routes: [{ id: 'search', method: 'POST', path: '/search', scope: 'authenticated', readOnly: true }],
        contributes: { 'search-provider': [{ id: 'records', title, route: 'search' }] },
    };
}

const reviews = provider('assurance', 'Assurance', 'Architecture reviews');
const delivery = provider('delivery', 'Delivery', 'Deployments');

type Pending = { resolve: (page: ExtensionSearchPage) => void; reject: (error: unknown) => void; signal?: AbortSignal };

/** A service whose search calls wait until the test settles them, keyed by extension, query and cursor. */
function controlledService() {
    const calls: Record<string, Pending> = {};
    const service = new ExtensionService();
    const search = vi.spyOn(service, 'search').mockImplementation(
        (id, _provider, query, cursor, signal) =>
            new Promise<ExtensionSearchPage>((resolve, reject) => {
                calls[`${id}:${query}:${cursor ?? ''}`] = { resolve, reject, signal };
            })
    );
    // A group can render before its effect sends the search, so a test waits for the call before it settles it.
    const sent = (...keys: string[]) => waitFor(() => keys.forEach((key) => expect(calls[key]).toBeDefined()));
    return { service, calls, search, sent };
}

function SearchFor({ q }: { q: string }) {
    const navigate = useNavigate();
    return <button onClick={() => navigate(`/search?q=${q}`)}>search {q}</button>;
}

function renderPage(service: ExtensionService, extensions: ExtensionSummary[], searchService?: SearchService, path = '/search?q=payments') {
    vi.spyOn(service, 'fetchExtensions').mockResolvedValue(extensions);
    const catalogueService = searchService ?? ({ search: vi.fn().mockResolvedValue(catalogue) } as unknown as SearchService);
    return render(
        <MemoryRouter initialEntries={[path]}>
            <ExtensionsProvider service={service}>
                <SearchResultsPage searchService={catalogueService} />
                <SearchFor q="treasury" />
            </ExtensionsProvider>
        </MemoryRouter>
    );
}

const group = (name: RegExp) => screen.getByRole('region', { name });

afterEach(() => vi.restoreAllMocks());

describe('SearchResultsPage with extension search providers', () => {
    it('leaves out the providers when the query has a qualifier', async () => {
        const { service, search } = controlledService();
        renderPage(service, [delivery], undefined, '/search?q=type:architecture%20payments');

        expect(await screen.findByText('Payments platform')).toBeInTheDocument();
        await waitFor(() => expect(service.fetchExtensions).toHaveBeenCalled());
        await act(async () => {});
        expect(screen.queryByTestId('provider-results')).not.toBeInTheDocument();
        expect(screen.getByText('1 result')).toBeInTheDocument();
        expect(search).not.toHaveBeenCalled();
    });

    it('shows each provider in its own group, so one failure keeps the catalogue and the other providers', async () => {
        const { service, calls, sent } = controlledService();
        renderPage(service, [reviews, delivery]);

        expect(await screen.findByText('Payments platform')).toBeInTheDocument();
        expect(within(await screen.findByRole('region', { name: /Architecture reviews/ })).getByRole('status')).toHaveTextContent(
            'Searching Assurance…'
        );
        expect(within(group(/Deployments/)).getByRole('status')).toHaveTextContent('Searching Delivery…');

        await sent('delivery:payments:');
        await act(async () =>
            calls['delivery:payments:'].resolve({
                results: [
                    {
                        id: 'prod',
                        title: 'Payments platform production',
                        summary: 'Release 2.4.0',
                        namespace: 'finos',
                        link: { hub: { namespace: 'finos', type: 'architectures', id: '1', version: '2.4.0' } },
                    },
                ],
            })
        );
        // The slow provider does not hold back the one that replied.
        expect(within(group(/Architecture reviews/)).getByRole('status')).toBeInTheDocument();
        const deployments = group(/Deployments \(1\)/);
        expect(within(deployments).getByRole('link', { name: 'Payments platform production' })).toHaveAttribute(
            'href',
            '/finos/architectures/1/2.4.0?exact=1'
        );
        expect(within(deployments).getByTestId('result-extension-chip')).toHaveTextContent('Delivery');

        await act(async () => calls['assurance:payments:'].reject(new ExtensionSearchError(true)));
        expect(within(group(/Architecture reviews/)).getByRole('alert')).toHaveTextContent(
            'Assurance did not reply in time. Results from other sources are still shown.'
        );
        expect(screen.getByText('Payments platform')).toBeInTheDocument();
        expect(within(group(/Deployments/)).getByText('Payments platform production')).toBeInTheDocument();
    });

    it('says so for a provider with no results, and when its search failed for another reason', async () => {
        const { service, calls, sent } = controlledService();
        renderPage(service, [reviews, delivery]);
        await sent('assurance:payments:', 'delivery:payments:');

        await act(async () => {
            calls['assurance:payments:'].reject(new ExtensionSearchError(false));
            calls['delivery:payments:'].resolve({ results: [] });
        });

        expect(within(group(/Architecture reviews/)).getByRole('alert')).toHaveTextContent('Assurance search failed.');
        expect(within(group(/^Deployments · Delivery$/)).getByText('No results from Delivery.')).toBeInTheDocument();
    });

    it('keeps the provider results when the catalogue search fails', async () => {
        const { service, calls, sent } = controlledService();
        const failing = { search: vi.fn().mockRejectedValue(new Error('down')) } as unknown as SearchService;
        renderPage(service, [delivery], failing);

        expect(await screen.findByText('Catalogue search failed, please try again.')).toBeInTheDocument();
        await sent('delivery:payments:');
        await act(async () => calls['delivery:payments:'].resolve({ results: [{ id: 'a', title: 'Payments deploy' }] }));
        expect(within(group(/Deployments/)).getByText('Payments deploy')).toBeInTheDocument();
    });

    it('drops a reply for an earlier query, and cancels its request', async () => {
        const { service, calls, sent } = controlledService();
        renderPage(service, [delivery]);
        await sent('delivery:payments:');
        const old = calls['delivery:payments:'];

        fireEvent.click(screen.getByRole('button', { name: 'search treasury' }));
        expect(old.signal?.aborted).toBe(true);
        await act(async () => old.resolve({ results: [{ id: 'old', title: 'Old payments result' }] }));

        expect(screen.queryByText('Old payments result')).not.toBeInTheDocument();
        expect(within(group(/Deployments/)).getByRole('status')).toHaveTextContent('Searching Delivery…');
        await act(async () => calls['delivery:treasury:'].resolve({ results: [{ id: 'new', title: 'Treasury settlement' }] }));
        expect(within(group(/Deployments \(1\)/)).getByText('Treasury settlement')).toBeInTheDocument();
    });

    it('tries a failed provider again without searching the others again', async () => {
        const { service, calls, search, sent } = controlledService();
        renderPage(service, [reviews, delivery]);
        await sent('assurance:payments:', 'delivery:payments:');
        await act(async () => {
            calls['assurance:payments:'].reject(new ExtensionSearchError(false));
            calls['delivery:payments:'].resolve({ results: [] });
        });
        search.mockClear();

        fireEvent.click(within(group(/Architecture reviews/)).getByRole('button', { name: 'Try again' }));

        // The button goes away while the group loads, so the focus moves to the group heading, not to the page.
        expect(screen.getByRole('heading', { name: /Architecture reviews/ })).toHaveFocus();
        expect(search).toHaveBeenCalledTimes(1);
        expect(search.mock.calls[0].slice(0, 4)).toEqual(['assurance', 'records', 'payments', undefined]);
        await act(async () => calls['assurance:payments:'].resolve({ results: [{ id: 'r', title: 'Payments review' }] }));
        expect(within(group(/Architecture reviews \(1\)/)).getByText('Payments review')).toBeInTheDocument();
    });

    it('loads the next page with the cursor, skips a repeated id, and keeps the results when a page fails', async () => {
        const { service, calls, sent } = controlledService();
        renderPage(service, [delivery]);
        await sent('delivery:payments:');
        await act(async () => calls['delivery:payments:'].resolve({ results: [{ id: 'a', title: 'First' }], next: 'p2' }));
        expect(group(/Deployments \(1\+\)/)).toBeInTheDocument();

        const more = () => screen.getByRole('button', { name: 'Show more from Deployments' });
        more().focus();
        fireEvent.click(more());
        expect(screen.getByRole('button', { name: 'Loading…' })).toHaveAttribute('aria-disabled', 'true');
        await act(async () =>
            calls['delivery:payments:p2'].resolve({
                results: [
                    { id: 'a', title: 'First again' },
                    { id: 'b', title: 'Second', link: { href: 'https://example.org/second' } },
                ],
                next: 'p3',
            })
        );
        expect(
            within(group(/Deployments \(2\+\)/))
                .getAllByRole('listitem')
                .map((item) => item.textContent)
        ).toEqual([expect.stringContaining('First'), expect.stringContaining('Second')]);
        expect(screen.getByRole('link', { name: /^Second/ })).toHaveFocus();

        more().focus();
        fireEvent.click(more());
        await act(async () => calls['delivery:payments:p3'].reject(new ExtensionSearchError(false)));
        expect(screen.getByText('More results could not be loaded.')).toBeInTheDocument();
        expect(more()).toHaveFocus();
        expect(within(group(/Deployments/)).getByText('Second')).toBeInTheDocument();
    });

    it(`stops offering more results at ${MAX_PROVIDER_RESULTS}`, async () => {
        const { service, calls, sent } = controlledService();
        renderPage(service, [delivery]);
        await sent('delivery:payments:');
        const page = (from: number) =>
            Array.from({ length: 10 }, (_, i) => ({
                id: String(from + i),
                title: `Result ${from + i}`,
                link: { href: `https://example.org/${from + i}` },
            }));

        await act(async () => calls['delivery:payments:'].resolve({ results: page(0), next: '10' }));
        for (let cursor = 10; cursor < MAX_PROVIDER_RESULTS; cursor += 10) {
            const more = screen.getByRole('button', { name: 'Show more from Deployments' });
            more.focus();
            fireEvent.click(more);
            await act(async () => calls[`delivery:payments:${cursor}`].resolve({ results: page(cursor), next: String(cursor + 10) }));
        }

        expect(within(group(/Deployments \(50\)/)).getAllByRole('listitem')).toHaveLength(MAX_PROVIDER_RESULTS);
        expect(screen.queryByRole('button', { name: 'Show more from Deployments' })).not.toBeInTheDocument();
        // The button went away with its focus, which moves to the first new result.
        expect(screen.getByRole('link', { name: /^Result 40\b/ })).toHaveFocus();
    });

    it('opens an external link in a new tab and shows a result with no link as text', async () => {
        const { service, calls, sent } = controlledService();
        renderPage(service, [delivery]);
        await sent('delivery:payments:');

        await act(async () =>
            calls['delivery:payments:'].resolve({
                results: [
                    { id: 'a', title: 'Runbook', link: { href: 'https://example.org/runbook' } },
                    { id: 'b', title: 'Plain record' },
                    { id: 'c', title: 'Script', link: { href: 'javascript:alert(1)' } },
                ],
            })
        );

        const runbook = screen.getByRole('link', { name: /Runbook/ });
        expect(runbook).toHaveAttribute('href', 'https://example.org/runbook');
        expect(runbook).toHaveAttribute('target', '_blank');
        expect(screen.getByText('Plain record').closest('a')).toBeNull();
        expect(screen.getByText('Script').closest('a')).toBeNull();
    });

    it('returns to the same query from a provider result and from a catalogue result', async () => {
        const { service, calls, sent } = controlledService();
        vi.spyOn(service, 'fetchExtensions').mockResolvedValue([delivery]);
        vi.spyOn(CalmService.prototype, 'fetchArchitectureVersions').mockResolvedValue(['1.0.0', '1.10.0']);
        const catalogueService = { search: vi.fn().mockResolvedValue(catalogue) } as unknown as SearchService;
        function Resource() {
            const location = useLocation();
            return (
                <>
                    <p data-testid="resource">{location.pathname + location.search}</p>
                    <ReturnLink />
                </>
            );
        }
        render(
            <MemoryRouter initialEntries={['/search?q=payments%20%E2%82%AC']}>
                <ExtensionsProvider service={service}>
                    <Routes>
                        <Route
                            path="/search"
                            element={
                                <ReturnPointProvider page={{ kind: 'search' }} label="search results">
                                    <SearchResultsPage searchService={catalogueService} />
                                </ReturnPointProvider>
                            }
                        />
                        <Route path={RESOURCE_ROUTE} element={<Resource />} />
                    </Routes>
                </ExtensionsProvider>
            </MemoryRouter>
        );
        await sent('delivery:payments €:');
        await act(async () =>
            calls['delivery:payments €:'].resolve({
                results: [
                    {
                        id: 'api',
                        title: 'Payments API',
                        link: { hub: { namespace: 'finos', type: 'architectures', id: '1', version: '2.4.0', element: 'api' } },
                    },
                ],
            })
        );

        fireEvent.click(screen.getByRole('link', { name: 'Payments API' }));
        expect(screen.getByTestId('resource')).toHaveTextContent('/finos/architectures/1/2.4.0?node=api');
        fireEvent.click(screen.getByRole('link', { name: 'Back to search results' }));

        fireEvent.click(await screen.findByRole('button', { name: /Payments platform/ }));
        expect(await screen.findByTestId('resource')).toHaveTextContent('/finos/architectures/1/1.10.0');
        expect(screen.getByRole('link', { name: 'Back to search results' })).toHaveAttribute('href', '/search?q=payments%20%E2%82%AC');
    });

    it('shows the logo of a provider beside its visible name, in the heading and on each result', async () => {
        const { service, calls, sent } = controlledService();
        vi.spyOn(service, 'fetchExtensions').mockResolvedValue([{ ...delivery, logo: { light: 'logo.svg' } }]);
        const assets = fakeImageAssets({ '/api/calm/extensions/delivery/logo/light': logoSvg('#0a0') });
        render(
            assets.wrap(
                <MemoryRouter initialEntries={['/search?q=payments']}>
                    <ExtensionsProvider service={service}>
                        <SearchResultsPage searchService={{ search: vi.fn().mockResolvedValue(catalogue) } as unknown as SearchService} />
                    </ExtensionsProvider>
                </MemoryRouter>
            )
        );
        await sent('delivery:payments:');
        await act(async () => calls['delivery:payments:'].resolve({ results: [{ id: 'a', title: 'Payments API' }] }));

        const deployments = group(/^Deployments \(1\) · Delivery$/);
        const logos = within(deployments).getAllByTestId('extension-logo');
        expect(logos).toHaveLength(2);
        expect(logos[0]).toHaveStyle({ width: '20px' });
        await waitFor(() => logos.forEach((logo) => expect(logo.querySelector('img')).toHaveAttribute('src', svgDataUrl(logoSvg('#0a0')))));
        logos.forEach((logo) => fireEvent.load(logo.querySelector('img')!));
        await waitFor(() => logos.forEach((logo) => expect(logo).toHaveAttribute('data-state', 'loaded')));
        expect(within(deployments).getByTestId('result-extension-chip')).toHaveTextContent('Delivery');
    });

    it('shows no provider group without a query, and only the catalogue when no extension has a provider', async () => {
        const { service, search } = controlledService();
        vi.spyOn(service, 'fetchExtensions').mockResolvedValue([delivery]);
        render(
            <MemoryRouter initialEntries={['/search']}>
                <ExtensionsProvider service={service}>
                    <SearchResultsPage searchService={{ search: vi.fn() } as unknown as SearchService} />
                </ExtensionsProvider>
            </MemoryRouter>
        );
        expect(screen.getByText(/Enter a search term/)).toBeInTheDocument();
        expect(screen.queryByTestId('provider-results')).not.toBeInTheDocument();
        expect(search).not.toHaveBeenCalled();
    });

    it('counts only the catalogue in the header when there are providers', async () => {
        vi.spyOn(ExtensionService.prototype, 'search').mockReturnValue(new Promise(() => {}));
        render(
            <MemoryRouter initialEntries={['/search?q=payments']}>
                <ExtensionsContext.Provider value={[delivery]}>
                    <SearchResultsPage searchService={{ search: vi.fn().mockResolvedValue(catalogue) } as unknown as SearchService} />
                </ExtensionsContext.Provider>
            </MemoryRouter>
        );
        expect(await screen.findByText('1 catalogue result')).toBeInTheDocument();
    });
});
