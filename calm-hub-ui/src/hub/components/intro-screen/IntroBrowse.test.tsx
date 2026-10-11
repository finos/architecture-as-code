import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IntroBrowse } from './IntroBrowse.js';
import { NamespaceCounts, DomainControlCount } from '../../../model/counts.js';
import { mockHeights, mockViewport } from '../../../test-support/layout-mocks.js';

const namespaceCounts: NamespaceCounts[] = [
    { namespace: 'finos', architectures: 2, patterns: 1, flows: 0, standards: 0, adrs: 0, interfaces: 0, total: 3 },
    { namespace: 'traderx', architectures: 1, patterns: 0, flows: 0, standards: 0, adrs: 0, interfaces: 0, total: 1 },
];
const domainCounts: DomainControlCount[] = [{ domain: 'security', controlCount: 4 }];

function LocationProbe() {
    const location = useLocation();
    return <div data-testid="location">{location.pathname}</div>;
}

function renderBrowse(nc: NamespaceCounts[], dc: DomainControlCount[]) {
    return render(
        <MemoryRouter>
            <IntroBrowse namespaceCounts={nc} domainCounts={dc} />
            <LocationProbe />
        </MemoryRouter>
    );
}

describe('IntroBrowse', () => {
    it('renders a clickable tile per namespace and control domain', () => {
        renderBrowse(namespaceCounts, domainCounts);

        expect(screen.getByText('finos')).toBeInTheDocument();
        expect(screen.getByText('traderx')).toBeInTheDocument();
        expect(screen.getByText('security')).toBeInTheDocument();
        // Two namespace tiles, one domain tile.
        expect(screen.getAllByTestId('browse-namespace')).toHaveLength(2);
        expect(screen.getAllByTestId('browse-domain')).toHaveLength(1);
    });

    it('links a namespace tile to its namespace page', () => {
        renderBrowse(namespaceCounts, domainCounts);
        fireEvent.click(screen.getByText('finos'));
        expect(screen.getByTestId('location')).toHaveTextContent('/namespace/finos');
    });

    it('links a control-domain tile to its domain page', () => {
        renderBrowse(namespaceCounts, domainCounts);
        fireEvent.click(screen.getByText('security'));
        expect(screen.getByTestId('location')).toHaveTextContent('/domain/security');
    });

    it('clamps a namespace description and lifts the clamp on hover or focus', () => {
        const [finos, traderx] = namespaceCounts;
        renderBrowse([{ ...finos, description: 'FINOS reference architectures' }, traderx], domainCounts);

        const [finosTile] = screen.getAllByTestId('browse-namespace');
        const description = screen.getByText('FINOS reference architectures');
        expect(finosTile).toHaveClass('group');
        expect(description).toHaveClass('line-clamp-2', 'group-hover:line-clamp-none', 'group-focus-visible:line-clamp-none');
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    describe('on mobile', () => {
        let restore: () => void;
        beforeEach(() => {
            restore = mockViewport(true);
        });
        afterEach(() => {
            restore();
            vi.restoreAllMocks();
        });

        const renderWithDescription = () => {
            const [finos, traderx] = namespaceCounts;
            renderBrowse([{ ...finos, description: 'FINOS reference architectures' }, traderx], domainCounts);
        };

        it('toggles the full description when the text is cut off, with the toggle outside the link', () => {
            mockHeights(80, 40);
            renderWithDescription();
            const description = screen.getByText('FINOS reference architectures');
            const toggle = screen.getByRole('button', { name: 'Show more' });
            expect(toggle.closest('a')).toBeNull();
            expect(description).toHaveClass('line-clamp-2');

            fireEvent.click(toggle);
            expect(description).not.toHaveClass('line-clamp-2');
            expect(screen.getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true');
            expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/);
        });

        it('shows no toggle when the description fits', () => {
            mockHeights(40, 40);
            renderWithDescription();
            expect(screen.queryByRole('button')).not.toBeInTheDocument();
        });

        it('still links the tile to its namespace page', () => {
            mockHeights(80, 40);
            renderWithDescription();
            fireEvent.click(screen.getByText('finos'));
            expect(screen.getByTestId('location')).toHaveTextContent('/namespace/finos');
        });
    });

    it('renders nothing when the catalogue is empty', () => {
        const { container } = renderBrowse([], []);
        expect(container.querySelector('[data-testid="browse-namespace"]')).toBeNull();
        expect(screen.queryByText('Namespaces')).not.toBeInTheDocument();
    });
});
