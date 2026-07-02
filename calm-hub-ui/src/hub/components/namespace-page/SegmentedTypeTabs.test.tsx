import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { SegmentedTypeTabs, type TypeTab } from './SegmentedTypeTabs.js';
import { TYPE_PANEL_ID } from './resource-type-meta.js';
import { colors } from '../../../theme/colors.js';

/** Drive `useIsMobile()` via window.matchMedia. Returns a restore function. */
function mockMatchMedia(isMobile: boolean) {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
        matches: isMobile,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    return () => {
        window.matchMedia = original;
    };
}

const tabs: TypeTab[] = [
    { type: 'Architectures', count: 6 },
    { type: 'Patterns', count: 4 },
    { type: 'Standards', count: 0 },
];

describe('SegmentedTypeTabs', () => {
    afterEach(() => {
        // Restore default desktop matchMedia between tests.
        window.matchMedia = ((query: string) => ({
            matches: false,
            media: query,
            onchange: null,
            addEventListener: () => {},
            removeEventListener: () => {},
            addListener: () => {},
            removeListener: () => {},
            dispatchEvent: () => false,
        })) as unknown as typeof window.matchMedia;
    });

    it('marks the active tab with blue text and aria-selected', () => {
        render(<SegmentedTypeTabs types={tabs} active="Architectures" onSelect={() => {}} />);
        const tab = screen.getByTestId('type-tab-Architectures');
        expect(tab).toHaveAttribute('aria-selected', 'true');
        expect(tab).toHaveStyle({ color: colors.redesign.activeText });
        // Active count badge is filled blue.
        expect(within(tab).getByTestId('count-badge')).toHaveStyle({
            backgroundColor: colors.redesign.primary,
        });
    });

    it('renders resting tabs with body text and a grey badge', () => {
        render(<SegmentedTypeTabs types={tabs} active="Architectures" onSelect={() => {}} />);
        const tab = screen.getByTestId('type-tab-Patterns');
        expect(tab).toHaveAttribute('aria-selected', 'false');
        expect(tab).toHaveStyle({ color: colors.redesign.bodyAlt });
        expect(within(tab).getByTestId('count-badge')).toHaveStyle({
            backgroundColor: colors.redesign.badgeBg,
        });
    });

    it('dims a zero-count tab but keeps it visible and selectable', () => {
        const onSelect = vi.fn();
        render(<SegmentedTypeTabs types={tabs} active="Architectures" onSelect={onSelect} />);
        const tab = screen.getByTestId('type-tab-Standards');
        // Visible (rendered) and dimmed.
        expect(tab).toBeInTheDocument();
        expect(tab).toHaveStyle({ color: colors.redesign.disabled });
        expect(within(tab).getByTestId('count-badge')).toHaveStyle({
            backgroundColor: colors.redesign.badgeBgFaint,
        });
        // Still selectable.
        fireEvent.click(tab);
        expect(onSelect).toHaveBeenCalledWith('Standards');
    });

    it('calls onSelect with the chosen type when a tab is clicked', () => {
        const onSelect = vi.fn();
        render(<SegmentedTypeTabs types={tabs} active="Architectures" onSelect={onSelect} />);
        fireEvent.click(screen.getByTestId('type-tab-Patterns'));
        expect(onSelect).toHaveBeenCalledWith('Patterns');
    });

    it('renders loading (undefined-count) tabs resting, with no count badge', () => {
        const loadingTabs: TypeTab[] = [
            { type: 'Architectures', count: undefined },
            { type: 'Patterns', count: undefined },
            { type: 'Standards', count: undefined },
        ];
        render(<SegmentedTypeTabs types={loadingTabs} active="Architectures" onSelect={() => {}} />);
        // A non-active, count-unknown tab is resting (body text), not the
        // disabled/faint dimmed styling reserved for a known zero.
        const tab = screen.getByTestId('type-tab-Patterns');
        expect(tab).toHaveStyle({ color: colors.redesign.bodyAlt });
        // No badge renders while the count is unknown — no premature "0".
        expect(within(tab).queryByTestId('count-badge')).not.toBeInTheDocument();
        expect(tab).not.toHaveTextContent('0');
    });

    it('renders a known zero count as a dimmed badge, not a hidden one', () => {
        // A genuine 0 (loaded) is distinct from a loading undefined: the badge shows
        // a dimmed "0" rather than being omitted.
        render(<SegmentedTypeTabs types={tabs} active="Architectures" onSelect={() => {}} />);
        const tab = screen.getByTestId('type-tab-Standards');
        const badge = within(tab).getByTestId('count-badge');
        expect(badge).toHaveTextContent('0');
        expect(badge).toHaveStyle({ backgroundColor: colors.redesign.badgeBgFaint });
    });

    it('wires the ARIA tabs pattern: ids, aria-controls and roving tabindex', () => {
        render(<SegmentedTypeTabs types={tabs} active="Architectures" onSelect={() => {}} />);
        const active = screen.getByTestId('type-tab-Architectures');
        const resting = screen.getByTestId('type-tab-Patterns');
        // Each tab controls the single panel and has a stable id.
        expect(active).toHaveAttribute('aria-controls', TYPE_PANEL_ID);
        expect(active).toHaveAttribute('id', 'type-tab-Architectures');
        // Roving tabindex: only the active tab is in the tab sequence.
        expect(active).toHaveAttribute('tabindex', '0');
        expect(resting).toHaveAttribute('tabindex', '-1');
    });

    it('moves selection with the Right arrow key', () => {
        const onSelect = vi.fn();
        render(<SegmentedTypeTabs types={tabs} active="Architectures" onSelect={onSelect} />);
        fireEvent.keyDown(screen.getByTestId('type-tab-Architectures'), { key: 'ArrowRight' });
        expect(onSelect).toHaveBeenCalledWith('Patterns');
    });

    it('wraps to the first tab when the Right arrow is pressed on the last tab', () => {
        const onSelect = vi.fn();
        const { getByTestId } = render(
            <SegmentedTypeTabs types={tabs} active="Standards" onSelect={onSelect} />
        );
        fireEvent.keyDown(getByTestId('type-tab-Standards'), { key: 'ArrowRight' });
        expect(onSelect).toHaveBeenCalledWith('Architectures');
    });

    it('moves selection with the Left arrow key (wrapping)', () => {
        const onSelect = vi.fn();
        render(<SegmentedTypeTabs types={tabs} active="Architectures" onSelect={onSelect} />);
        // From the first tab, Left wraps to the last.
        fireEvent.keyDown(screen.getByTestId('type-tab-Architectures'), { key: 'ArrowLeft' });
        expect(onSelect).toHaveBeenCalledWith('Standards');
    });

    it('exposes a brand-coloured focus-visible ring on each tab', () => {
        render(<SegmentedTypeTabs types={tabs} active="Architectures" onSelect={() => {}} />);
        const tab = screen.getByTestId('type-tab-Architectures');
        expect(tab.className).toContain('focus-visible:outline-2');
        expect(tab.className).toContain('focus-visible:outline-[var(--color-interaction)]');
    });

    it('scrolls horizontally on mobile (overflow-x-auto)', () => {
        const restore = mockMatchMedia(true);
        render(<SegmentedTypeTabs types={tabs} active="Architectures" onSelect={() => {}} />);
        expect(screen.getByRole('tablist')).toHaveClass('overflow-x-auto');
        restore();
    });

    it('does not apply horizontal scroll on desktop', () => {
        render(<SegmentedTypeTabs types={tabs} active="Architectures" onSelect={() => {}} />);
        expect(screen.getByRole('tablist')).not.toHaveClass('overflow-x-auto');
    });
});
