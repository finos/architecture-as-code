import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { IntroBrowse } from './IntroBrowse.js';
import { NamespaceCounts, DomainControlCount } from '../../../model/counts.js';

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

    it('shows a namespace description in its tile, with the full text on hover', () => {
        const [finos, traderx] = namespaceCounts;
        renderBrowse([{ ...finos, description: 'FINOS reference architectures' }, traderx], domainCounts);

        const [finosTile, traderxTile] = screen.getAllByTestId('browse-namespace');
        expect(screen.getByText('FINOS reference architectures')).toHaveAttribute('title', 'FINOS reference architectures');
        expect(finosTile).not.toHaveAttribute('title');
        expect(traderxTile.querySelector('[title]')).toBeNull();
        expect(screen.getByTestId('browse-domain').querySelector('[title]')).toBeNull();
    });

    it('renders nothing when the catalogue is empty', () => {
        const { container } = renderBrowse([], []);
        expect(container.querySelector('[data-testid="browse-namespace"]')).toBeNull();
        expect(screen.queryByText('Namespaces')).not.toBeInTheDocument();
    });
});
