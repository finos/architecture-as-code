import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GlobalSearchBar } from './GlobalSearchBar.js';
import { SearchService } from '../../service/search-service.js';
import { GroupedSearchResults } from '../../model/search.js';

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

describe('GlobalSearchBar', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders search input', () => {
        renderSearchBar();
        expect(screen.getByPlaceholderText('Search CALM Hub...')).toBeInTheDocument();
    });

    it('debounces API calls', async () => {
        const searchFn = vi.fn().mockResolvedValue(emptyResults);
        const service = createMockSearchService(searchFn);
        renderSearchBar(service);

        const input = screen.getByPlaceholderText('Search CALM Hub...');

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

        const input = screen.getByPlaceholderText('Search CALM Hub...');

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

        const input = screen.getByPlaceholderText('Search CALM Hub...');
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

        const input = screen.getByPlaceholderText('Search CALM Hub...');
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

        const input = screen.getByPlaceholderText('Search CALM Hub...');

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

        const input = screen.getByPlaceholderText('Search CALM Hub...');

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

    it('closes dropdown on Escape', async () => {
        const searchFn = vi.fn().mockResolvedValue(mockResults);
        const service = createMockSearchService(searchFn);
        renderSearchBar(service);

        const input = screen.getByPlaceholderText('Search CALM Hub...');

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

        const input = screen.getByPlaceholderText('Search CALM Hub...');

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

        const input = screen.getByPlaceholderText('Search CALM Hub...');

        await act(async () => {
            fireEvent.change(input, { target: { value: 'test' } });
        });

        await act(async () => {
            vi.advanceTimersByTime(300);
            await vi.runAllTimersAsync();
        });

        expect(screen.getByText('Search failed, please try again')).toBeInTheDocument();
    });

    it('does not search when input is empty', async () => {
        const searchFn = vi.fn().mockResolvedValue(emptyResults);
        const service = createMockSearchService(searchFn);
        renderSearchBar(service);

        const input = screen.getByPlaceholderText('Search CALM Hub...');

        await act(async () => {
            fireEvent.change(input, { target: { value: '   ' } });
        });

        await act(async () => {
            vi.advanceTimersByTime(300);
        });

        expect(searchFn).not.toHaveBeenCalled();
    });
});
