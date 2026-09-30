import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { CollapsedRail } from './CollapsedRail.js';
import { anchorFlyout } from './flyout-anchor.js';
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

const flyoutWrapper = () => screen.getByText('calm').closest('.fixed') as HTMLElement;
const flyoutPanel = () => screen.getByText('calm').closest('div[style*="max-height"]') as HTMLElement;

/** jsdom reports every box as zero-sized, so the trigger is placed by hand. */
function stubRect(trigger: HTMLElement, top: number) {
    const height = 24;
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
        top, bottom: top + height, left: 0, right: 32, width: 32, height, x: 0, y: top, toJSON: () => ({}),
    });
}

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

    it('closes the fly-out on Escape and returns focus to the trigger', () => {
        renderRail();
        const finosInitial = screen.getByRole('button', { name: 'finos' });
        fireEvent.focus(finosInitial);
        const calmLink = screen.getByRole('link', { name: /calm/ });
        calmLink.focus();

        fireEvent.keyDown(calmLink, { key: 'Escape' });

        expect(screen.queryByText('calm')).not.toBeInTheDocument();
        expect(document.activeElement).toBe(finosInitial);
    });

    it('keeps the fly-out open when the pointer leaves but focus is still inside', () => {
        renderRail();
        const finosInitial = screen.getByRole('button', { name: 'finos' });
        finosInitial.focus();
        fireEvent.focus(finosInitial);
        expect(screen.getByText('calm')).toBeInTheDocument();

        fireEvent.mouseLeave(finosInitial.parentElement as HTMLElement);

        expect(screen.getByText('calm')).toBeInTheDocument();
    });

    it('opens the fly-out when the trigger is activated by keyboard or click', () => {
        renderRail();
        const finosInitial = screen.getByRole('button', { name: 'finos' });
        expect(screen.queryByText('calm')).not.toBeInTheDocument();

        fireEvent.click(finosInitial);

        expect(screen.getByText('calm')).toBeInTheDocument();
    });

    it('reopens after Escape, because Escape refocuses the trigger it just dismissed', () => {
        renderRail();
        const finosInitial = screen.getByRole('button', { name: 'finos' });
        fireEvent.focus(finosInitial);
        fireEvent.keyDown(screen.getByRole('link', { name: /calm/ }), { key: 'Escape' });
        expect(screen.queryByText('calm')).not.toBeInTheDocument();

        fireEvent.click(finosInitial);

        expect(screen.getByText('calm')).toBeInTheDocument();
    });

    it('carries the gap to the panel as padding on a descendant, not a margin on the panel', () => {
        renderRail();
        fireEvent.focus(screen.getByRole('button', { name: 'finos' }));

        // A margin would sit outside the hover container, so crossing it fires mouseleave and
        // unmounts the panel before the pointer arrives. jsdom has no geometry to catch that,
        // so the structure is asserted instead.
        const positioned = screen.getByText('calm').closest('.fixed') as HTMLElement;
        expect(positioned.className).toContain('pl-1');
        expect(positioned.className).not.toContain('ml-1');
        expect(positioned.contains(screen.getByText('calm'))).toBe(true);
    });

    it('does not mark a group-only fly-out row as the active page', () => {
        // barclays is group-only: only barclays.payments is a namespace.
        renderRail('/namespace/barclays');
        fireEvent.focus(screen.getByRole('button', { name: 'barclays' }));

        const row = screen.getByText('barclays').closest('div') as HTMLElement;
        expect(row.style.backgroundColor).toBe('');
        expect(row.style.boxShadow).toBe('');
    });

    it('closes the fly-out when a namespace is chosen, so it does not hang over the new page', () => {
        renderRail();
        const finosInitial = screen.getByRole('button', { name: 'finos' });
        fireEvent.focus(finosInitial);

        const link = screen.getByRole('link', { name: /calm/ });
        link.focus(); // a browser focuses the link on click, which used to hold the panel open
        fireEvent.click(link);

        expect(screen.queryByText('calm')).not.toBeInTheDocument();
    });

    it('stays open when a part that cannot take focus is clicked under the pointer', () => {
        renderRail();
        const barclaysInitial = screen.getByRole('button', { name: 'barclays' });
        fireEvent.mouseEnter(barclaysInitial.parentElement as HTMLElement);
        barclaysInitial.focus();
        fireEvent.focus(barclaysInitial);
        expect(screen.getByText('payments')).toBeInTheDocument();

        // A grouping-only row is a <span>, so clicking it blurs to nothing.
        fireEvent.blur(barclaysInitial, { relatedTarget: null });

        expect(screen.getByText('payments')).toBeInTheDocument();
    });

    it('still closes when focus leaves and the pointer is already away', () => {
        renderRail();
        const finosInitial = screen.getByRole('button', { name: 'finos' });
        fireEvent.focus(finosInitial);
        expect(screen.getByText('calm')).toBeInTheDocument();

        fireEvent.blur(finosInitial, { relatedTarget: document.body });

        expect(screen.queryByText('calm')).not.toBeInTheDocument();
    });

    it('caps the fly-out height so a deep subtree can scroll', () => {
        renderRail();
        const trigger = screen.getByRole('button', { name: 'finos' });
        stubRect(trigger, 100);

        fireEvent.focus(trigger);

        // The figures are anchorFlyout's, over jsdom's 768px window; its own suite covers them.
        expect(flyoutWrapper()).toHaveStyle({ top: '100px', left: '32px' });
        expect(flyoutPanel()).toHaveStyle({ maxHeight: `${anchorFlyout(trigger.getBoundingClientRect(), 768).maxHeight}px`, overflowY: 'auto' });
    });

    it('scrolls the root initials, so a window too short for them all still reaches every one', () => {
        renderRail();

        // The rail sits in an overflow-hidden row, so an unbounded list is clipped with no way
        // to scroll to the roots below the fold. jsdom has no layout, so the box is asserted.
        const list = screen.getByRole('button', { name: 'finos' }).closest('.overflow-auto');
        expect(list?.className).toContain('flex-1');
        expect(list?.className).toContain('min-h-0');
        // The focus ring is drawn 3px outside the initial, and the scroll container clips it.
        expect(list?.className).toContain('pt-1');
    });

    it('positions the fly-out against the viewport, so the scrolling rail cannot clip it', () => {
        renderRail();
        fireEvent.focus(screen.getByRole('button', { name: 'finos' }));

        // Scrolling the initials makes the rail a clipping box for anything positioned inside it.
        const positioned = screen.getByText('calm').closest('.fixed');
        expect(positioned).toBeInTheDocument();
    });

    it('takes the upward anchor when the trigger is near the foot of the window', () => {
        renderRail();
        const trigger = screen.getByRole('button', { name: 'finos' });
        stubRect(trigger, 700);

        fireEvent.focus(trigger);

        // Opening downward leaves 60px, so the last rows would sit below the window.
        const wrapper = flyoutWrapper();
        expect(wrapper).toHaveStyle({ bottom: '44px' });
        expect(wrapper.style.top).toBe('');
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
