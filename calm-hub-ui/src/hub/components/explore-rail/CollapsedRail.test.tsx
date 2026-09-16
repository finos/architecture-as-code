import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { CollapsedRail } from './CollapsedRail.js';
import { colors } from '../../../theme/colors.js';
import { redesignTokens } from '../../../theme/redesign-tokens.js';
import type { NamespaceCounts } from '../../../model/counts.js';

function nc(namespace: string, total: number): NamespaceCounts {
    return { namespace, architectures: 0, patterns: 0, flows: 0, standards: 0, adrs: 0, interfaces: 0, total };
}

const namespaceCounts: NamespaceCounts[] = [nc('finos.calm', 5), nc('barclays.payments', 3), nc('acme', 2)];

const renderRail = (path = '/') => {
    const onExpand = vi.fn();
    const rail = <CollapsedRail namespaceCounts={namespaceCounts} onExpand={onExpand} />;
    const utils = render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                {['/', '/namespace/:ns', '/:namespace/:type/:id/:version'].map((p) => (
                    <Route key={p} path={p} element={rail} />
                ))}
            </Routes>
        </MemoryRouter>
    );
    return { ...utils, onExpand };
};

describe('CollapsedRail', () => {
    it('shows one initial per root namespace, in tree order', () => {
        renderRail();
        const initials = screen.getAllByRole('button', { name: /^(acme|barclays|finos)$/ });
        expect(initials.map((b) => b.textContent)).toEqual(['A', 'B', 'F']);
    });

    it('calls onExpand from the expand-sidebar button', () => {
        const { onExpand } = renderRail();
        fireEvent.click(screen.getByLabelText('Expand sidebar'));
        expect(onExpand).toHaveBeenCalled();
    });

    it('accents the root initial whose subtree contains the active namespace', () => {
        renderRail('/namespace/finos.calm');
        const finosInitial = screen.getByRole('button', { name: 'finos' });
        expect(finosInitial).toHaveStyle({ backgroundColor: colors.redesign.tintBg, boxShadow: redesignTokens.shadow.railAccent });

        const acmeInitial = screen.getByRole('button', { name: 'acme' });
        expect(acmeInitial).not.toHaveStyle({ backgroundColor: colors.redesign.tintBg });
    });

    it('opens the fly-out for a root on hover', () => {
        renderRail();
        expect(screen.queryByText('calm')).not.toBeInTheDocument();

        fireEvent.mouseEnter(screen.getByRole('button', { name: 'finos' }).parentElement!);
        expect(screen.getByText('calm')).toBeInTheDocument();

        fireEvent.mouseLeave(screen.getByRole('button', { name: 'finos' }).parentElement!);
        expect(screen.queryByText('calm')).not.toBeInTheDocument();
    });

    it('opens the fly-out for a root on focus', () => {
        renderRail();
        const finosInitial = screen.getByRole('button', { name: 'finos' });
        expect(screen.queryByText('calm')).not.toBeInTheDocument();

        fireEvent.focus(finosInitial);
        expect(screen.getByText('calm')).toBeInTheDocument();
    });

    it('closes the fly-out on Escape', () => {
        renderRail();
        const finosInitial = screen.getByRole('button', { name: 'finos' });
        fireEvent.focus(finosInitial);
        expect(screen.getByText('calm')).toBeInTheDocument();

        fireEvent.keyDown(finosInitial, { key: 'Escape' });
        expect(screen.queryByText('calm')).not.toBeInTheDocument();
    });

    it('renders a group-only root row inside the fly-out without a link', () => {
        renderRail();
        fireEvent.focus(screen.getByRole('button', { name: 'barclays' }));

        // 'barclays' itself has no direct count (only barclays.payments does) —
        // its own row inside the fly-out is text, not a link.
        expect(screen.getByText('barclays', { selector: 'span' })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /^barclays$/ })).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: /payments/ })).toHaveAttribute('href', '/namespace/barclays.payments');
    });
});
