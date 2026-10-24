import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ExplorerSearch } from './ExplorerSearch.js';
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
    architectures: [{ namespace: 'finos', id: 1, name: 'Test Architecture', description: 'A test architecture' }],
    patterns: [{ namespace: 'finos', id: 2, name: 'Test Pattern', description: 'A test pattern' }],
    flows: [],
    standards: [],
    interfaces: [],
    controls: [],
    adrs: [],
};

function createMockSearchService(searchFn: (q: string) => Promise<GroupedSearchResults>) {
    return { search: searchFn } as unknown as SearchService;
}

function renderSearch(searchService?: SearchService, onSearchingChange?: (a: boolean) => void) {
    return render(
        <MemoryRouter>
            <ExplorerSearch searchService={searchService} onSearchingChange={onSearchingChange} />
        </MemoryRouter>
    );
}

describe('ExplorerSearch', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders search input', () => {
        renderSearch();
        expect(screen.getByPlaceholderText('Search CALM Hub...')).toBeInTheDocument();
    });

    it('debounces API calls', async () => {
        const searchFn = vi.fn().mockResolvedValue(emptyResults);
        renderSearch(createMockSearchService(searchFn));
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

    it('displays grouped results inline', async () => {
        const searchFn = vi.fn().mockResolvedValue(mockResults);
        renderSearch(createMockSearchService(searchFn));
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

    it('notifies the parent when a search becomes active and inactive', async () => {
        const onSearchingChange = vi.fn();
        const searchFn = vi.fn().mockResolvedValue(mockResults);
        renderSearch(createMockSearchService(searchFn), onSearchingChange);
        const input = screen.getByPlaceholderText('Search CALM Hub...');

        await act(async () => {
            fireEvent.change(input, { target: { value: 'test' } });
        });
        expect(onSearchingChange).toHaveBeenLastCalledWith(true);

        await act(async () => {
            fireEvent.click(screen.getByLabelText('Clear search'));
        });
        expect(onSearchingChange).toHaveBeenLastCalledWith(false);
    });

    it('shows no results message when search returns empty', async () => {
        const searchFn = vi.fn().mockResolvedValue(emptyResults);
        renderSearch(createMockSearchService(searchFn));
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
        renderSearch(createMockSearchService(searchFn));
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

    it('points the combobox at the listbox and at the highlighted option', async () => {
        renderSearch(createMockSearchService(vi.fn().mockResolvedValue(mockResults)));

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

    it('drops the active descendant when the results close', async () => {
        renderSearch(createMockSearchService(vi.fn().mockResolvedValue(mockResults)));

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
        renderSearch(createMockSearchService(vi.fn().mockResolvedValue(mockResults)));

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

    it('clears results on Escape', async () => {
        const searchFn = vi.fn().mockResolvedValue(mockResults);
        renderSearch(createMockSearchService(searchFn));
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
        renderSearch(createMockSearchService(searchFn));
        const input = screen.getByPlaceholderText('Search CALM Hub...');

        await act(async () => {
            fireEvent.change(input, { target: { value: 'test' } });
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(300);
        });

        await act(async () => {
            fireEvent.click(screen.getByLabelText('Clear search'));
        });

        expect(input).toHaveValue('');
        expect(screen.queryByText('Test Architecture')).not.toBeInTheDocument();
    });

    it('handles API errors gracefully', async () => {
        const searchFn = vi.fn().mockRejectedValue(new Error('Network error'));
        renderSearch(createMockSearchService(searchFn));
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
        renderSearch(createMockSearchService(searchFn));
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
