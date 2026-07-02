import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { NamespaceCounts, DomainControlCount } from '../../../model/counts.js';

// Mock the bounded fetch hook so the landing renders deterministically without
// touching CalmService. Its own behaviour is covered in useCatalogueHighlights.test.
const mockUse = vi.fn();
vi.mock('./useCatalogueHighlights.js', () => ({
    useCatalogueHighlights: (...args: unknown[]) => mockUse(...args),
}));

import { FirstRunLanding } from './FirstRunLanding.js';

const counts = (over: Partial<NamespaceCounts>): NamespaceCounts => ({
    namespace: 'ns',
    architectures: 0,
    patterns: 0,
    flows: 0,
    standards: 0,
    adrs: 0,
    interfaces: 0,
    total: 0,
    ...over,
});

const namespaceCounts: NamespaceCounts[] = [
    counts({ namespace: 'finos', architectures: 2, patterns: 1 }),
    counts({ namespace: 'traderx', architectures: 1, patterns: 3 }),
];
const domainCounts: DomainControlCount[] = [{ domain: 'security', controlCount: 4 }];

function renderLanding() {
    return render(
        <MemoryRouter>
            <FirstRunLanding namespaceCounts={namespaceCounts} domainCounts={domainCounts} />
        </MemoryRouter>
    );
}

describe('FirstRunLanding', () => {
    it('renders the heading, sub-paragraph and stat tiles with values from counts', () => {
        mockUse.mockReturnValue({ highlights: [], loading: false });
        renderLanding();

        expect(
            screen.getByRole('heading', { name: /explore the architecture catalogue/i })
        ).toBeInTheDocument();

        expect(screen.getByText('Namespaces').closest('[data-testid="stat-tile"]')).toHaveTextContent('2');
        expect(screen.getByText('Architectures').closest('[data-testid="stat-tile"]')).toHaveTextContent('3');
        expect(screen.getByText('Patterns').closest('[data-testid="stat-tile"]')).toHaveTextContent('4');
        expect(screen.getByText('Controls').closest('[data-testid="stat-tile"]')).toHaveTextContent('4');
    });

    it('renders catalogue highlights under an honest "Browse the catalogue" heading (not "Recently updated")', () => {
        mockUse.mockReturnValue({
            highlights: [
                { namespace: 'finos', id: 'a1', name: 'TraderX Architecture', type: 'Architectures' },
            ],
            loading: false,
        });
        renderLanding();

        expect(screen.getByText(/browse the catalogue/i)).toBeInTheDocument();
        expect(screen.queryByText(/recently updated/i)).not.toBeInTheDocument();
        expect(screen.getByText('TraderX Architecture')).toBeInTheDocument();
    });

    it('omits the catalogue section when there are no highlights', () => {
        mockUse.mockReturnValue({ highlights: [], loading: false });
        renderLanding();
        expect(screen.queryByText(/browse the catalogue/i)).not.toBeInTheDocument();
    });
});
