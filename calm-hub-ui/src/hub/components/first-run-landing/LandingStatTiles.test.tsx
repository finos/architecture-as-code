import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LandingStatTiles } from './LandingStatTiles.js';
import { colors } from '../../../theme/colors.js';
import type { NamespaceCounts, DomainControlCount } from '../../../model/counts.js';

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
    counts({ namespace: 'finos', architectures: 3, patterns: 2 }),
    counts({ namespace: 'traderx', architectures: 1, patterns: 4 }),
];
const domainCounts: DomainControlCount[] = [
    { domain: 'security', controlCount: 5 },
    { domain: 'resilience', controlCount: 2 },
];

describe('LandingStatTiles', () => {
    it('derives all four totals from the counts (no extra fetch)', () => {
        render(<LandingStatTiles namespaceCounts={namespaceCounts} domainCounts={domainCounts} />);

        const tiles = screen.getAllByTestId('stat-tile');
        expect(tiles).toHaveLength(4);

        // Namespaces = number of namespaces (2)
        expect(screen.getByText('Namespaces').closest('[data-testid="stat-tile"]')).toHaveTextContent('2');
        // Architectures = 3 + 1
        expect(screen.getByText('Architectures').closest('[data-testid="stat-tile"]')).toHaveTextContent('4');
        // Patterns = 2 + 4
        expect(screen.getByText('Patterns').closest('[data-testid="stat-tile"]')).toHaveTextContent('6');
        // Controls = 5 + 2 (from domain counts)
        expect(screen.getByText('Controls').closest('[data-testid="stat-tile"]')).toHaveTextContent('7');
    });

    it('renders the Namespaces number in the redesign blue accent', () => {
        render(<LandingStatTiles namespaceCounts={namespaceCounts} domainCounts={domainCounts} />);
        const nsTile = screen.getByText('Namespaces').closest('[data-testid="stat-tile"]')!;
        const numberEl = nsTile.querySelector('.font-mono-jb') as HTMLElement;
        // jsdom normalises hex to rgb; compare via the element's inline style colour.
        expect(numberEl.style.color.replace(/\s/g, '')).toBe('rgb(37,99,235)');
        expect(colors.redesign.primary).toBe('#2563EB');
    });

    it('renders zeros for an empty catalogue', () => {
        render(<LandingStatTiles namespaceCounts={[]} domainCounts={[]} />);
        const tiles = screen.getAllByTestId('stat-tile');
        tiles.forEach((t) => expect(t).toHaveTextContent('0'));
    });

    it('shows a dash placeholder (no zero-flash) until counts have loaded', () => {
        render(
            <LandingStatTiles namespaceCounts={namespaceCounts} domainCounts={domainCounts} loaded={false} />
        );
        const tiles = screen.getAllByTestId('stat-tile');
        expect(tiles).toHaveLength(4);
        tiles.forEach((t) => {
            expect(t).toHaveTextContent('—');
            expect(t).not.toHaveTextContent(/[0-9]/);
        });
    });
});
