import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IntroSearchBar } from './IntroSearchBar.js';
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

// A control result: controls route by name with no version lookup, so navigation
// is deterministic without stubbing CalmService.
const controlResults: GroupedSearchResults = {
    ...emptyResults,
    controls: [{ namespace: 'security', id: 7, name: 'PCI-DSS', description: 'Encryption at rest' }],
};

const groupedResults: GroupedSearchResults = {
    ...controlResults,
    standards: [{ namespace: 'security', id: 8, name: 'Encryption Standard', description: 'AES-256' }],
};

function createMockSearchService(searchFn: (q: string) => Promise<GroupedSearchResults>) {
    return { search: searchFn } as unknown as SearchService;
}

function LocationProbe() {
    const location = useLocation();
    return <div data-testid="location">{location.pathname + location.search}</div>;
}

function renderBar(searchService?: SearchService) {
    return render(
        <MemoryRouter initialEntries={['/']}>
            <IntroSearchBar searchService={searchService} />
            <LocationProbe />
        </MemoryRouter>
    );
}

describe('IntroSearchBar', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('navigates to the results page when the query is submitted with Enter', () => {
        renderBar(createMockSearchService(vi.fn().mockResolvedValue(emptyResults)));

        const input = screen.getByLabelText('Search the architecture catalogue');
        fireEvent.change(input, { target: { value: 'payments' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        expect(screen.getByTestId('location')).toHaveTextContent('/search?q=payments');
    });

    it('navigates to the results page when the Search button is clicked', () => {
        renderBar(createMockSearchService(vi.fn().mockResolvedValue(emptyResults)));

        const input = screen.getByLabelText('Search the architecture catalogue');
        fireEvent.change(input, { target: { value: 'a b' } });
        fireEvent.click(screen.getByLabelText('Search'));

        // The space is percent-encoded in the query string.
        expect(screen.getByTestId('location')).toHaveTextContent('/search?q=a%20b');
    });

    it('does not submit an empty/whitespace query', () => {
        renderBar(createMockSearchService(vi.fn().mockResolvedValue(emptyResults)));

        const input = screen.getByLabelText('Search the architecture catalogue');
        fireEvent.change(input, { target: { value: '   ' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        expect(screen.getByTestId('location')).toHaveTextContent('/');
        expect(screen.getByTestId('location')).not.toHaveTextContent('/search');
    });

    it('deep-links to a selected dropdown result instead of the results page', async () => {
        renderBar(createMockSearchService(vi.fn().mockResolvedValue(controlResults)));

        const input = screen.getByLabelText('Search the architecture catalogue');
        await act(async () => {
            fireEvent.change(input, { target: { value: 'pci' } });
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(300);
        });

        fireEvent.mouseDown(screen.getByText('PCI-DSS'));

        expect(screen.getByTestId('location')).toHaveTextContent('/security/controls/PCI-DSS/detail');
    });

    it('points the combobox at the listbox and at the highlighted option', async () => {
        renderBar(createMockSearchService(vi.fn().mockResolvedValue(groupedResults)));

        const input = screen.getByRole('combobox');
        expect(input).not.toHaveAttribute('aria-controls');

        await act(async () => {
            fireEvent.change(input, { target: { value: 'enc' } });
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
        renderBar(createMockSearchService(vi.fn().mockResolvedValue(groupedResults)));

        const input = screen.getByRole('combobox');
        await act(async () => {
            fireEvent.change(input, { target: { value: 'enc' } });
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
        renderBar(createMockSearchService(vi.fn().mockResolvedValue(groupedResults)));

        const input = screen.getByRole('combobox');
        await act(async () => {
            fireEvent.change(input, { target: { value: 'enc' } });
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(300);
        });

        const standards = screen.getByRole('group', { name: 'Standards' });
        expect(within(standards).getByRole('option')).toHaveTextContent('Encryption Standard');
        const controls = screen.getByRole('group', { name: 'Controls' });
        expect(within(controls).getByRole('option')).toHaveTextContent('PCI-DSS');
    });
});
