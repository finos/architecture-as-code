import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { NamespaceRailItem } from './NamespaceRailItem.js';
import { buildNamespaceTree } from './namespace-tree.js';
import { colors } from '../../../theme/colors.js';
import type { NamespaceCounts } from '../../../model/counts.js';

function nc(namespace: string, total: number): NamespaceCounts {
    return { namespace, architectures: 0, patterns: 0, flows: 0, standards: 0, adrs: 0, interfaces: 0, total };
}

const renderItem = (overrides: Partial<React.ComponentProps<typeof NamespaceRailItem>> = {}) => {
    const tree = buildNamespaceTree([nc('finos.calm', 5)]);
    const node = tree[0].children[0]; // finos.calm — a real namespace at depth 1
    const props: React.ComponentProps<typeof NamespaceRailItem> = {
        node,
        depth: 1,
        hasChildren: false,
        collapsed: false,
        descendantTotal: 0,
        active: false,
        filtering: false,
        needle: '',
        onToggleCollapsed: vi.fn(),
        ...overrides,
    };
    return render(
        <MemoryRouter>
            <NamespaceRailItem {...props} />
        </MemoryRouter>
    );
};

describe('NamespaceRailItem', () => {
    it('renders the chevron and the label as distinct hit targets', () => {
        const onToggleCollapsed = vi.fn();
        renderItem({ hasChildren: true, onToggleCollapsed });

        const chevron = screen.getByRole('button', { name: /finos.calm/ });
        const link = screen.getByRole('link', { name: 'finos.calm' });
        expect(chevron).not.toBe(link);

        fireEvent.click(chevron);
        expect(onToggleCollapsed).toHaveBeenCalledWith('finos.calm');

        // Clicking the label must not toggle collapse — that is the chevron's job alone.
        onToggleCollapsed.mockClear();
        fireEvent.click(link);
        expect(onToggleCollapsed).not.toHaveBeenCalled();
    });

    it('flips aria-expanded and its accessible label with collapsed state', () => {
        const { rerender } = renderItem({ hasChildren: true, collapsed: false });
        expect(screen.getByRole('button', { name: 'Collapse finos.calm' })).toHaveAttribute('aria-expanded', 'true');

        rerender(
            <MemoryRouter>
                <NamespaceRailItem
                    node={buildNamespaceTree([nc('finos.calm', 5)])[0].children[0]}
                    depth={1}
                    hasChildren={true}
                    collapsed={true}
                    descendantTotal={5}
                    active={false}
                    filtering={false}
                    needle=""
                    onToggleCollapsed={vi.fn()}
                />
            </MemoryRouter>
        );
        expect(screen.getByRole('button', { name: 'Expand finos.calm' })).toHaveAttribute('aria-expanded', 'false');
    });

    it('shows a child row by its last segment, with the full path as title and accessible name', () => {
        renderItem();
        const link = screen.getByRole('link', { name: 'finos.calm' });
        expect(link).toHaveTextContent('calm');
        expect(link).not.toHaveTextContent('finos.calm.calm');
        expect(link).toHaveAttribute('title', 'finos.calm');
        expect(link).toHaveAttribute('href', '/namespace/finos.calm');
    });

    it('renders a synthetic grouping row with no link and no own pill, but a working chevron', () => {
        const tree = buildNamespaceTree([nc('finos.calm', 5)]);
        const finos = tree[0]; // 'finos' is group-only here
        const onToggleCollapsed = vi.fn();
        render(
            <MemoryRouter>
                <NamespaceRailItem
                    node={finos}
                    depth={0}
                    hasChildren={true}
                    collapsed={false}
                    descendantTotal={5}
                    active={false}
                    filtering={false}
                    needle=""
                    onToggleCollapsed={onToggleCollapsed}
                />
            </MemoryRouter>
        );
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
        expect(screen.queryByTestId('count-badge')).not.toBeInTheDocument();
        expect(screen.getByText('finos')).toHaveStyle({ color: colors.redesign.muted });
        expect(screen.getByText('finos')).toHaveClass('italic');

        const chevron = screen.getByRole('button', { name: 'Collapse finos' });
        fireEvent.click(chevron);
        expect(onToggleCollapsed).toHaveBeenCalledWith('finos');
    });

    it('shows the ghost pill only when collapsed', () => {
        const { rerender } = renderItem({ hasChildren: true, collapsed: false, descendantTotal: 5 });
        expect(screen.queryByTestId('nested-count-badge')).not.toBeInTheDocument();

        rerender(
            <MemoryRouter>
                <NamespaceRailItem
                    node={buildNamespaceTree([nc('finos.calm', 5)])[0].children[0]}
                    depth={1}
                    hasChildren={true}
                    collapsed={true}
                    descendantTotal={5}
                    active={false}
                    filtering={false}
                    needle=""
                    onToggleCollapsed={vi.fn()}
                />
            </MemoryRouter>
        );
        expect(screen.getByTestId('nested-count-badge')).toHaveTextContent('+5');
    });

    it('suppresses the ghost pill while filtering, even when collapsed is somehow true', () => {
        renderItem({ hasChildren: true, collapsed: true, descendantTotal: 5, filtering: true });
        expect(screen.queryByTestId('nested-count-badge')).not.toBeInTheDocument();
    });

    it('hides the chevron while filtering, so a click cannot rewrite the collapsed set unseen', () => {
        const onToggleCollapsed = vi.fn();
        renderItem({ hasChildren: true, filtering: true, needle: 'calm', onToggleCollapsed });

        expect(screen.queryByRole('button', { name: /finos.calm/ })).not.toBeInTheDocument();
        expect(onToggleCollapsed).not.toHaveBeenCalled();
    });

    it('renders one indent guide per depth level, uncapped', () => {
        const { container, rerender } = renderItem({ depth: 2 });
        expect(container.querySelectorAll('span[style*="border-left"]')).toHaveLength(2);

        rerender(
            <MemoryRouter>
                <NamespaceRailItem
                    node={buildNamespaceTree([nc('finos.calm', 5)])[0].children[0]}
                    depth={6}
                    hasChildren={false}
                    collapsed={false}
                    descendantTotal={0}
                    active={false}
                    filtering={false}
                    needle=""
                    onToggleCollapsed={vi.fn()}
                />
            </MemoryRouter>
        );
        expect(container.querySelectorAll('span[style*="border-left"]')).toHaveLength(6);
    });

    it('marks the active row with the accent treatment and aria-current', () => {
        renderItem({ active: true });
        const link = screen.getByRole('link', { name: 'finos.calm' });
        expect(link).toHaveStyle({ color: colors.redesign.activeText });
        expect(link).toHaveAttribute('aria-current', 'page');
    });

    it('highlights the matched substring while filtering', () => {
        renderItem({ filtering: true, needle: 'calm' });
        const mark = screen.getByText('calm', { selector: 'mark' });
        expect(mark).toHaveStyle({ backgroundColor: colors.redesign.tintBg, color: colors.redesign.primaryText });
    });
});
