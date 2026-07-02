import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CatalogueHighlights } from './CatalogueHighlights.js';

function renderHighlights(props: Parameters<typeof CatalogueHighlights>[0]) {
    return render(
        <MemoryRouter>
            <CatalogueHighlights {...props} />
        </MemoryRouter>
    );
}

describe('CatalogueHighlights', () => {
    it('shows a spinner (no heading) while loading', () => {
        const { container } = renderHighlights({ highlights: [], loading: true });
        expect(screen.queryByText(/browse the catalogue/i)).not.toBeInTheDocument();
        expect(container.querySelector('.loading-spinner')).toBeInTheDocument();
    });

    it('renders nothing once loaded with no highlights', () => {
        renderHighlights({ highlights: [], loading: false });
        expect(screen.queryByText(/browse the catalogue/i)).not.toBeInTheDocument();
        expect(screen.queryByTestId('catalogue-card')).not.toBeInTheDocument();
    });

    it('renders the honest heading and cards of mixed types when there are highlights', () => {
        renderHighlights({
            highlights: [
                { namespace: 'finos', id: 'a1', name: 'Arch One', type: 'Architectures' },
                { namespace: 'traderx', id: 'p1', name: 'Pattern One', type: 'Patterns' },
            ],
            loading: false,
        });
        expect(screen.getByText(/browse the catalogue/i)).toBeInTheDocument();
        expect(screen.queryByText(/recently updated/i)).not.toBeInTheDocument();
        expect(screen.getAllByTestId('catalogue-card')).toHaveLength(2);
        // Each card carries its own type's badge — the strip spans more than one type.
        const badges = screen.getAllByTestId('type-badge').map((b) => b.textContent);
        expect(badges).toEqual(['Architecture', 'Pattern']);
    });

    it('renders both cards (no key collision) when an architecture and pattern share a namespace + id', () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        renderHighlights({
            highlights: [
                { namespace: 'finos', id: '1', name: 'Arch', type: 'Architectures' },
                { namespace: 'finos', id: '1', name: 'Pattern', type: 'Patterns' },
            ],
            loading: false,
        });
        expect(screen.getAllByTestId('catalogue-card')).toHaveLength(2);
        // The type-qualified key keeps React from warning about duplicate keys.
        expect(errorSpy).not.toHaveBeenCalledWith(
            expect.stringContaining('two children with the same key'),
            expect.anything(),
            expect.anything()
        );
        errorSpy.mockRestore();
    });
});
