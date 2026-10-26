import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { vi, describe, it, expect } from 'vitest';
import { SearchResultsPage } from './SearchResultsPage.js';
import { SearchService } from '../../../service/search-service.js';
import { GroupedSearchResults } from '../../../model/search.js';

const emptyResults: GroupedSearchResults = {
    architectures: [],
    patterns: [],
    flows: [],
    standards: [],
    interfaces: [],
    controls: [],
    adrs: [],
};

const controlResults: GroupedSearchResults = {
    ...emptyResults,
    controls: [{ namespace: 'security', id: 7, name: 'PCI-DSS', description: 'Encryption at rest' }],
};

function createMockSearchService(searchFn: (q: string) => Promise<GroupedSearchResults>) {
    return { search: searchFn } as unknown as SearchService;
}

function LocationProbe() {
    const location = useLocation();
    return <div data-testid="location">{location.pathname + location.search}</div>;
}

function renderPage(path: string, searchService?: SearchService) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <SearchResultsPage searchService={searchService} />
            <LocationProbe />
        </MemoryRouter>
    );
}

describe('SearchResultsPage', () => {
    it('prompts for a term when there is no query', () => {
        renderPage('/search', createMockSearchService(vi.fn().mockResolvedValue(emptyResults)));
        expect(screen.getByText(/Enter a search term/i)).toBeInTheDocument();
    });

    it('shows a loading state while the search is in flight', async () => {
        let resolve!: (r: GroupedSearchResults) => void;
        const pending = new Promise<GroupedSearchResults>((r) => {
            resolve = r;
        });
        renderPage('/search?q=payments', createMockSearchService(() => pending));

        expect(await screen.findByText('Searching…')).toBeInTheDocument();
        // Must NOT flash the empty state before the search resolves.
        expect(screen.queryByText(/No results found/i)).not.toBeInTheDocument();

        await act(async () => {
            resolve(emptyResults);
            await pending;
        });
    });

    it('renders grouped results with a count and the query echoed', async () => {
        renderPage('/search?q=pci', createMockSearchService(vi.fn().mockResolvedValue(controlResults)));

        expect(await screen.findByText('PCI-DSS')).toBeInTheDocument();
        expect(screen.getByText('1 result')).toBeInTheDocument();
        expect(screen.getByText('“pci”')).toBeInTheDocument();
        expect(screen.getByText(/Controls \(1\)/)).toBeInTheDocument();
    });

    it('deep-links into the resource when a result is clicked', async () => {
        renderPage('/search?q=pci', createMockSearchService(vi.fn().mockResolvedValue(controlResults)));

        fireEvent.click(await screen.findByText('PCI-DSS'));

        await waitFor(() =>
            expect(screen.getByTestId('location')).toHaveTextContent('/security/controls/PCI-DSS/detail')
        );
    });

    it('shows an empty state when nothing matches', async () => {
        renderPage('/search?q=zzz', createMockSearchService(vi.fn().mockResolvedValue(emptyResults)));
        expect(await screen.findByText(/No results found for/i)).toBeInTheDocument();
    });

    it('shows an error state when the search fails', async () => {
        renderPage('/search?q=boom', createMockSearchService(vi.fn().mockRejectedValue(new Error('nope'))));
        expect(await screen.findByText(/Search failed/i)).toBeInTheDocument();
    });

    it('shows only the results for the current query when an earlier search settles late', async () => {
        const pending: Record<string, (r: GroupedSearchResults) => void> = {};
        const service = createMockSearchService(
            (q) => new Promise<GroupedSearchResults>((resolve) => { pending[q] = resolve; })
        );
        function SearchFor({ q }: { q: string }) {
            const navigate = useNavigate();
            return <button onClick={() => navigate(`/search?q=${q}`)}>search {q}</button>;
        }
        render(
            <MemoryRouter initialEntries={['/search?q=old']}>
                <SearchResultsPage searchService={service} />
                <SearchFor q="pci" />
            </MemoryRouter>
        );

        fireEvent.click(screen.getByRole('button', { name: 'search pci' }));
        await act(async () => pending.old(controlResults));
        expect(screen.getByText('Searching…')).toBeInTheDocument();
        expect(screen.queryByText('PCI-DSS')).not.toBeInTheDocument();

        await act(async () => pending.pci(emptyResults));
        expect(screen.getByText(/No results found/i)).toBeInTheDocument();
    });
});
