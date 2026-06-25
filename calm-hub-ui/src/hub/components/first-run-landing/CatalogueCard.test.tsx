import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CatalogueCard } from './CatalogueCard.js';
import type { CatalogueHighlight } from './useCatalogueHighlights.js';

describe('CatalogueCard', () => {
    const archItem: CatalogueHighlight = {
        namespace: 'finos',
        id: 'arch-1',
        name: 'TraderX Architecture',
        type: 'Architectures',
    };

    it('shows the name, an Architecture badge and a mono namespace chip', () => {
        render(
            <MemoryRouter>
                <CatalogueCard item={archItem} />
            </MemoryRouter>
        );
        expect(screen.getByText('TraderX Architecture')).toBeInTheDocument();
        expect(screen.getByTestId('type-badge')).toHaveTextContent('Architecture');
        expect(screen.getByText('finos')).toBeInTheDocument();
    });

    it('links to the namespace page (architectures tab), not a precomputed detail route', () => {
        render(
            <MemoryRouter>
                <CatalogueCard item={archItem} />
            </MemoryRouter>
        );
        expect(screen.getByTestId('catalogue-card')).toHaveAttribute(
            'href',
            '/namespace/finos?type=architectures'
        );
    });

    it('uses the item\'s own type for a pattern: Pattern badge and the patterns tab', () => {
        const patternItem: CatalogueHighlight = {
            namespace: 'traderx',
            id: 'pat-1',
            name: 'Microservice Pattern',
            type: 'Patterns',
        };
        render(
            <MemoryRouter>
                <CatalogueCard item={patternItem} />
            </MemoryRouter>
        );
        expect(screen.getByTestId('type-badge')).toHaveTextContent('Pattern');
        expect(screen.getByTestId('catalogue-card')).toHaveAttribute(
            'href',
            '/namespace/traderx?type=patterns'
        );
    });
});
