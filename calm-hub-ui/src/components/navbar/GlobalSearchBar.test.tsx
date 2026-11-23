import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { GlobalSearchBar } from './GlobalSearchBar.js';
import { SearchQueryError, SearchService } from '../../service/search-service.js';
import { CalmService } from '../../service/calm-service.js';
import { GroupedSearchResults } from '../../model/search.js';
import { RESOURCE_ROUTE } from '../../hub/routes.js';
import { ReturnLink } from '../../navigation/ReturnLink.js';
import { ReturnPointProvider } from '../../navigation/ReturnPointProvider.js';

const emptyResults: GroupedSearchResults = {
    architectures: [],
    patterns: [],
    flows: [],
    standards: [],
    interfaces: [],
    controls: [],
    adrs: [],
};

const mockResults: GroupedSearchResults = {
    architectures: [
        { namespace: 'finos', id: 1, name: 'Test Architecture', description: 'A test architecture' },
    ],
    patterns: [
        { namespace: 'finos', id: 2, name: 'Test Pattern', description: 'A test pattern' },
    ],
    flows: [],
    standards: [],
    interfaces: [],
    controls: [],
    adrs: [],
};

// Two architectures sharing a name but living in different namespaces — the
// ambiguous-duplicate case the namespace chip must disambiguate (problem #9).
const duplicateNameResults: GroupedSearchResults = {
    architectures: [
        { namespace: 'finos', id: 1, name: 'TraderX Architecture', description: 'in finos' },
        { namespace: 'traderx', id: 2, name: 'TraderX Architecture', description: 'in traderx' },
    ],
    patterns: [],
    flows: [],
    standards: [],
    interfaces: [],
    controls: [],
    adrs: [],
};

function createMockSearchService(searchFn: (q: string) => Promise<GroupedSearchResults>) {
    return { search: searchFn } as unknown as SearchService;
}

function renderSearchBar(searchService?: SearchService) {
    return render(
        <MemoryRouter>
            <GlobalSearchBar searchService={searchService} />
        </MemoryRouter>
    );
}

function LocationProbe() {
    const location = useLocation();
    return <div data-testid="location">{location.pathname + location.search}</div>;
}

function renderWithLocation(searchService?: SearchService) {
    return render(
        <MemoryRouter initialEntries={['/']}>
            <GlobalSearchBar searchService={searchService} />
            <LocationProbe />
        </MemoryRouter>
    );
}

describe('GlobalSearchBar', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders search input', () => {
        renderSearchBar();
        expect(screen.getByPlaceholderText('Search CALM Hub… e.g. namespace:finos type:pattern')).toBeInTheDocument();
    });

    it('debounces API calls', async () => {
        const searchFn = vi.fn().mockResolvedValue(emptyResults);
        const service = createMockSearchService(searchFn);
        renderSearchBar(service);

        const input = screen.getByPlaceholderText('Search CALM Hub… e.g. namespace:finos type:pattern');

        await act(async () => {
            fireEvent.change(input, { target: { value: 't' } });
            fireEvent.change(input, { target: { value: 'te' } });
            fireEvent.change(input, { target: { value: 'tes' } });
            fireEvent.change(input, { target: { value: 'test' } });
        });

        expect(searchFn).not.toHaveBeenCalled();

        await act(async () => {
            vi.advanceTimersByTime(300);
        });

        expect(searchFn).toHaveBeenCalledTimes(1);
        expect(searchFn).toHaveBeenCalledWith('test');
    });

    it('displays grouped results', async () => {
        const searchFn = vi.fn().mockResolvedValue(mockResults);
        const service = createMockSearchService(searchFn);
        renderSearchBar(service);

        const input = screen.getByPlaceholderText('Search CALM Hub… e.g. namespace:finos type:pattern');

        await act(async () => {
            fireEvent.change(input, { target: { value: 'test' } });
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(300);
        });

        expect(screen.getByText('Test Architecture')).toBeInTheDocument();
        expect(screen.getByText('Test Pattern')).toBeInTheDocument();
        expect(screen.getByText('Architectures')).toBeInTheDocument();
        expect(screen.getByText('Patterns')).toBeInTheDocument();
    });

    it('renders a namespace chip on each result row', async () => {
        const searchFn = vi.fn().mockResolvedValue(mockResults);
        const service = createMockSearchService(searchFn);
        renderSearchBar(service);

        const input = screen.getByPlaceholderText('Search CALM Hub… e.g. namespace:finos type:pattern');
        await act(async () => {
            fireEvent.change(input, { target: { value: 'test' } });
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(300);
        });

        const chips = screen.getAllByTestId('result-namespace-chip');
        expect(chips).toHaveLength(2); // one per result (arch + pattern)
        expect(chips.every((c) => c.textContent === 'finos')).toBe(true);

        // The name must shrink-truncate (min-w-0 + truncate) so a long name never
        // pushes the namespace chip off the row — the #9 disambiguation depends on
        // the chip staying visible.
        const name = screen.getByText('Test Architecture');
        expect(name).toHaveClass('truncate');
        expect(name).toHaveClass('min-w-0');
    });

    it('disambiguates duplicate names via the namespace chip', async () => {
        const searchFn = vi.fn().mockResolvedValue(duplicateNameResults);
        const service = createMockSearchService(searchFn);
        renderSearchBar(service);

        const input = screen.getByPlaceholderText('Search CALM Hub… e.g. namespace:finos type:pattern');
        await act(async () => {
            fireEvent.change(input, { target: { value: 'traderx' } });
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(300);
        });

        // Both rows show the same name...
        expect(screen.getAllByText('TraderX Architecture')).toHaveLength(2);
        // ...but distinct namespace chips tell them apart.
        const chips = screen.getAllByTestId('result-namespace-chip');
        const chipText = chips.map((c) => c.textContent).sort();
        expect(chipText).toEqual(['finos', 'traderx']);
    });

    it('shows no results message when search returns empty', async () => {
        const searchFn = vi.fn().mockResolvedValue(emptyResults);
        const service = createMockSearchService(searchFn);
        renderSearchBar(service);

        const input = screen.getByPlaceholderText('Search CALM Hub… e.g. namespace:finos type:pattern');

        await act(async () => {
            fireEvent.change(input, { target: { value: 'test' } });
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(300);
        });

        expect(screen.getByText('No results found')).toBeInTheDocument();
    });

    it('navigates with keyboard ArrowDown and Enter', async () => {
        const searchFn = vi.fn().mockResolvedValue(mockResults);
        const service = createMockSearchService(searchFn);
        renderSearchBar(service);

        const input = screen.getByPlaceholderText('Search CALM Hub… e.g. namespace:finos type:pattern');

        await act(async () => {
            fireEvent.change(input, { target: { value: 'test' } });
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(300);
        });

        await act(async () => {
            fireEvent.keyDown(input, { key: 'ArrowDown' });
        });

        const firstOption = screen.getAllByRole('option')[0];
        expect(firstOption).toHaveAttribute('aria-selected', 'true');
    });

    it('points the combobox at the listbox and at the highlighted option', async () => {
        renderSearchBar(createMockSearchService(vi.fn().mockResolvedValue(mockResults)));

        const input = screen.getByRole('combobox');
        expect(input).not.toHaveAttribute('aria-controls');

        await act(async () => {
            fireEvent.change(input, { target: { value: 'test' } });
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(300);
        });

        const listbox = screen.getByRole('listbox');
        expect(listbox.id).not.toBe('');
        expect(input).toHaveAttribute('aria-controls', listbox.id);
        expect(input).not.toHaveAttribute('aria-activedescendant');

        const options = screen.getAllByRole('option');
        await act(async () => {
            fireEvent.keyDown(input, { key: 'ArrowDown' });
        });
        expect(options[0].id).not.toBe('');
        expect(input).toHaveAttribute('aria-activedescendant', options[0].id);

        await act(async () => {
            fireEvent.keyDown(input, { key: 'ArrowDown' });
        });
        expect(input).toHaveAttribute('aria-activedescendant', options[1].id);
    });

    it('drops the active descendant when the dropdown closes', async () => {
        renderSearchBar(createMockSearchService(vi.fn().mockResolvedValue(mockResults)));

        const input = screen.getByRole('combobox');
        await act(async () => {
            fireEvent.change(input, { target: { value: 'test' } });
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(300);
        });
        await act(async () => {
            fireEvent.keyDown(input, { key: 'ArrowDown' });
        });
        await act(async () => {
            fireEvent.keyDown(input, { key: 'Escape' });
        });

        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        expect(input).not.toHaveAttribute('aria-activedescendant');
        expect(input).not.toHaveAttribute('aria-controls');
    });

    it('groups options under their result type', async () => {
        renderSearchBar(createMockSearchService(vi.fn().mockResolvedValue(mockResults)));

        const input = screen.getByRole('combobox');
        await act(async () => {
            fireEvent.change(input, { target: { value: 'test' } });
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(300);
        });

        const architectures = screen.getByRole('group', { name: 'Architectures' });
        expect(within(architectures).getByRole('option')).toHaveTextContent('Test Architecture');
        const patterns = screen.getByRole('group', { name: 'Patterns' });
        expect(within(patterns).getByRole('option')).toHaveTextContent('Test Pattern');
    });

    it('navigates to the results page when Enter is pressed with no result highlighted', () => {
        renderWithLocation(createMockSearchService(vi.fn().mockResolvedValue(mockResults)));

        const input = screen.getByPlaceholderText('Search CALM Hub… e.g. namespace:finos type:pattern');
        fireEvent.change(input, { target: { value: 'payments' } });
        // No timers advanced → no dropdown/selection yet, so Enter submits the query.
        fireEvent.keyDown(input, { key: 'Enter' });

        expect(screen.getByTestId('location')).toHaveTextContent('/search?q=payments');
    });

    it('does not fire a stray search after submitting (pending debounce is cancelled)', async () => {
        const searchFn = vi.fn().mockResolvedValue(mockResults);
        renderWithLocation(createMockSearchService(searchFn));

        const input = screen.getByPlaceholderText('Search CALM Hub… e.g. namespace:finos type:pattern');
        // Type then submit BEFORE the 300ms debounce fires.
        fireEvent.change(input, { target: { value: 'payments' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(300);
        });

        // The scheduled debounce must have been cancelled by submit: no request, and
        // no dropdown reopening over the results page.
        expect(searchFn).not.toHaveBeenCalled();
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        expect(screen.getByTestId('location')).toHaveTextContent('/search?q=payments');
    });

    it('does not reopen the dropdown with stale results after the query is cleared', async () => {
        // A search that stays in flight until we resolve it by hand.
        let resolveSearch!: (r: GroupedSearchResults) => void;
        const searchFn = vi.fn().mockImplementation(
            () => new Promise<GroupedSearchResults>((res) => { resolveSearch = res; })
        );
        renderWithLocation(createMockSearchService(searchFn));

        const input = screen.getByPlaceholderText('Search CALM Hub… e.g. namespace:finos type:pattern');

        // Fire a search for "test" and leave it unresolved.
        fireEvent.change(input, { target: { value: 'test' } });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(300);
        });
        expect(searchFn).toHaveBeenCalledWith('test');

        // Backspace to empty — this must abort the in-flight "test" request.
        fireEvent.change(input, { target: { value: '' } });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(300);
        });

        // The stale request resolves; its results must be discarded, not shown.
        await act(async () => {
            resolveSearch(mockResults);
        });

        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        expect(screen.queryByText('Test Architecture')).not.toBeInTheDocument();
    });

    it('deep-links (does not go to the results page) when a highlighted result is chosen with Enter', async () => {
        renderWithLocation(createMockSearchService(vi.fn().mockResolvedValue(mockResults)));

        const input = screen.getByPlaceholderText('Search CALM Hub… e.g. namespace:finos type:pattern');
        await act(async () => {
            fireEvent.change(input, { target: { value: 'test' } });
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(300);
        });

        fireEvent.keyDown(input, { key: 'ArrowDown' });
        fireEvent.keyDown(input, { key: 'Enter' });

        // Architecture selected → resolves latest version async; regardless it must
        // NOT land on the /search results page.
        expect(screen.getByTestId('location')).not.toHaveTextContent('/search');
    });

    it('closes dropdown on Escape', async () => {
        const searchFn = vi.fn().mockResolvedValue(mockResults);
        const service = createMockSearchService(searchFn);
        renderSearchBar(service);

        const input = screen.getByPlaceholderText('Search CALM Hub… e.g. namespace:finos type:pattern');

        await act(async () => {
            fireEvent.change(input, { target: { value: 'test' } });
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(300);
        });

        await act(async () => {
            fireEvent.keyDown(input, { key: 'Escape' });
        });

        expect(screen.queryByText('Test Architecture')).not.toBeInTheDocument();
    });

    it('clears search on clear button click', async () => {
        const searchFn = vi.fn().mockResolvedValue(mockResults);
        const service = createMockSearchService(searchFn);
        renderSearchBar(service);

        const input = screen.getByPlaceholderText('Search CALM Hub… e.g. namespace:finos type:pattern');

        await act(async () => {
            fireEvent.change(input, { target: { value: 'test' } });
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(300);
        });

        const clearButton = screen.getByLabelText('Clear search');

        await act(async () => {
            fireEvent.click(clearButton);
        });

        expect(input).toHaveValue('');
        expect(screen.queryByText('Test Architecture')).not.toBeInTheDocument();
    });

    it('handles API errors gracefully', async () => {
        const searchFn = vi.fn().mockRejectedValue(new Error('Network error'));
        const service = createMockSearchService(searchFn);
        renderSearchBar(service);

        const input = screen.getByPlaceholderText('Search CALM Hub… e.g. namespace:finos type:pattern');

        await act(async () => {
            fireEvent.change(input, { target: { value: 'test' } });
        });

        await act(async () => {
            vi.advanceTimersByTime(300);
            await vi.runAllTimersAsync();
        });

        expect(screen.getByText('Search failed, please try again')).toBeInTheDocument();
    });

    // 1.10.0 is the latest version, so the result opens this same address. From 1.0.0 it opens 1.10.0, where a
    // timeline can redirect back to 1.0.0, its current moment.
    it.each(['1.10.0', '1.0.0'])(
        'adds no return point for the resource on show at %s, and adds one for another resource',
        async (version) => {
            const platforms: GroupedSearchResults = {
                ...emptyResults,
                architectures: [
                    { namespace: 'finos', id: 1, name: 'Payments platform', description: '' },
                    { namespace: 'finos', id: 2, name: 'Trading platform', description: '' },
                ],
            };
            const searchService = createMockSearchService(vi.fn().mockResolvedValue(platforms));
            const calmService = { fetchArchitectureVersions: vi.fn().mockResolvedValue(['1.0.0', '1.10.0']) } as unknown as CalmService;
            function ResourcePage() {
                const { namespace, type, id, version } = useParams();
                const location = useLocation();
                return (
                    <ReturnPointProvider
                        page={{ kind: 'resource', namespace: namespace!, type: type!, id: id!, version: version! }}
                        label={`Architecture ${id} ${version}`}
                    >
                        <GlobalSearchBar searchService={searchService} calmService={calmService} />
                        <ReturnLink />
                        <p data-testid="location" data-key={location.key}>
                            {location.pathname}
                        </p>
                    </ReturnPointProvider>
                );
            }
            render(
                <MemoryRouter
                    initialEntries={[
                        {
                            pathname: `/finos/architectures/1/${version}`,
                            state: { returnTo: [{ page: { kind: 'search' }, search: '?q=payments', label: 'search results' }] },
                        },
                    ]}
                >
                    <Routes>
                        <Route path={RESOURCE_ROUTE} element={<ResourcePage />} />
                    </Routes>
                </MemoryRouter>
            );
            const choose = async (name: string) => {
                await act(async () => {
                    fireEvent.change(screen.getByPlaceholderText('Search CALM Hub… e.g. namespace:finos type:pattern'), { target: { value: 'platform' } });
                });
                await act(async () => {
                    await vi.advanceTimersByTimeAsync(300);
                });
                const before = screen.getByTestId('location').dataset.key;
                await act(async () => {
                    fireEvent.mouseDown(screen.getByRole('option', { name: new RegExp(name) }));
                });
                expect(screen.getByTestId('location').dataset.key).not.toBe(before);
            };

            await choose('Payments platform');
            expect(screen.getByTestId('location')).toHaveTextContent('/finos/architectures/1/1.10.0');
            expect(screen.getByRole('link', { name: 'Back to search results' })).toBeInTheDocument();

            await choose('Trading platform');
            expect(screen.getByTestId('location')).toHaveTextContent('/finos/architectures/2/1.10.0');
            expect(screen.getByRole('link', { name: 'Back to Architecture 1 1.10.0' })).toBeInTheDocument();
        }
    );

    it('does not search when input is empty', async () => {
        const searchFn = vi.fn().mockResolvedValue(emptyResults);
        const service = createMockSearchService(searchFn);
        renderSearchBar(service);

        const input = screen.getByPlaceholderText('Search CALM Hub… e.g. namespace:finos type:pattern');

        await act(async () => {
            fireEvent.change(input, { target: { value: '   ' } });
        });

        await act(async () => {
            vi.advanceTimersByTime(300);
        });

        expect(searchFn).not.toHaveBeenCalled();
    });

    describe('qualifiers', () => {
        const PLACEHOLDER = 'Search CALM Hub… e.g. namespace:finos type:pattern';

        function renderWithNamespaces(fetchNamespaces = vi.fn().mockResolvedValue(['payments', 'payments.cards'])) {
            const calmService = { fetchNamespaces } as unknown as CalmService;
            render(
                <MemoryRouter>
                    <GlobalSearchBar
                        searchService={createMockSearchService(vi.fn().mockResolvedValue(emptyResults))}
                        calmService={calmService}
                    />
                </MemoryRouter>
            );
            return screen.getByPlaceholderText(PLACEHOLDER) as HTMLInputElement;
        }

        async function type(input: HTMLInputElement, value: string) {
            await act(async () => {
                fireEvent.focus(input);
                fireEvent.change(input, { target: { value } });
            });
        }

        it('suggests a qualifier key and completes it with Tab', async () => {
            const input = renderWithNamespaces();
            await type(input, 'na');

            expect(screen.getByRole('option', { name: /namespace:/ })).toBeInTheDocument();

            await act(async () => {
                fireEvent.keyDown(input, { key: 'Tab' });
            });
            expect(input.value).toBe('namespace:');
        });

        it('suggests namespaces and adds a space after the chosen one', async () => {
            const input = renderWithNamespaces();
            await type(input, 'namespace:pay');

            const options = screen.getAllByRole('option');
            expect(options.map((o) => o.textContent)).toEqual(['payments', 'payments.cards']);

            // Up from the first option wraps to the last.
            for (const key of ['ArrowDown', 'ArrowUp', 'ArrowUp', 'Enter']) {
                await act(async () => {
                    fireEvent.keyDown(input, { key });
                });
            }
            expect(input.value).toBe('namespace:payments.cards ');
        });

        it('completes a partly typed key on Enter, as Tab does', async () => {
            const input = renderWithNamespaces();
            await type(input, 'ty');

            await act(async () => {
                fireEvent.keyDown(input, { key: 'Enter' });
            });
            expect(input.value).toBe('type:');
        });

        it('closes the suggestions on a delete, so Enter searches what is left', async () => {
            const searchFn = vi.fn().mockResolvedValue(emptyResults);
            render(
                <MemoryRouter>
                    <GlobalSearchBar
                        searchService={createMockSearchService(searchFn)}
                        calmService={{ fetchNamespaces: vi.fn().mockResolvedValue([]) } as unknown as CalmService}
                    />
                    <LocationProbe />
                </MemoryRouter>
            );
            const input = screen.getByPlaceholderText(PLACEHOLDER) as HTMLInputElement;
            await type(input, 'names');
            expect(screen.getByRole('option', { name: /namespace:/ })).toBeInTheDocument();

            await act(async () => {
                fireEvent.input(input, { target: { value: 'name' }, inputType: 'deleteContentBackward' });
            });
            expect(screen.queryByRole('option')).not.toBeInTheDocument();

            await act(async () => {
                fireEvent.keyDown(input, { key: 'Enter' });
            });
            expect(screen.getByTestId('location')).toHaveTextContent('/search?q=name');
        });

        it('does not search while a qualifier has no value', async () => {
            const searchFn = vi.fn().mockResolvedValue(emptyResults);
            render(
                <MemoryRouter>
                    <GlobalSearchBar
                        searchService={createMockSearchService(searchFn)}
                        calmService={{ fetchNamespaces: vi.fn().mockResolvedValue([]) } as unknown as CalmService}
                    />
                </MemoryRouter>
            );
            await type(screen.getByPlaceholderText(PLACEHOLDER) as HTMLInputElement, 'trade type:');
            await act(async () => {
                vi.advanceTimersByTime(300);
            });
            expect(searchFn).not.toHaveBeenCalled();
        });

        it('accepts a type suggestion with a click', async () => {
            const input = renderWithNamespaces();
            await type(input, 'type:fl');

            await act(async () => {
                fireEvent.mouseDown(screen.getByRole('option', { name: /flow/ }));
            });
            expect(input.value).toBe('type:flow ');
        });

        it('hides the suggestions on Escape', async () => {
            const input = renderWithNamespaces();
            await type(input, 'ty');

            await act(async () => {
                fireEvent.keyDown(input, { key: 'Escape' });
            });
            expect(screen.queryByRole('option')).not.toBeInTheDocument();
        });

        it('suggests no namespaces when they fail to load', async () => {
            const input = renderWithNamespaces(vi.fn().mockRejectedValue(new Error('down')));
            await type(input, 'namespace:');

            expect(screen.queryByRole('option')).not.toBeInTheDocument();
        });

        it('underlines an unknown type', async () => {
            const input = renderWithNamespaces();
            await type(input, 'type:decorator ');

            expect(screen.getByText('decorator')).toHaveClass('text-error');
        });

        it('shows the server message for an invalid query', async () => {
            const searchFn = vi.fn().mockRejectedValue(new SearchQueryError('Unknown type. Use one of: pattern', true));
            render(
                <MemoryRouter>
                    <GlobalSearchBar
                        searchService={createMockSearchService(searchFn)}
                        calmService={{ fetchNamespaces: vi.fn().mockResolvedValue([]) } as unknown as CalmService}
                    />
                </MemoryRouter>
            );
            const input = screen.getByPlaceholderText(PLACEHOLDER) as HTMLInputElement;
            await type(input, 'type:bad ');
            await act(async () => {
                vi.advanceTimersByTime(300);
            });

            expect(screen.getByText('Unknown type. Use one of: pattern')).toBeInTheDocument();
        });
    });
});
