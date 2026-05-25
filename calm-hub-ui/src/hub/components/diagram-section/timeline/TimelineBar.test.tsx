import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { TimelineBar, type TimelineMoment } from './TimelineBar.js';

const moments: TimelineMoment[] = [
    { key: 'm1', label: '1.0.0', version: '1.0.0', validFrom: '2025-01-01' },
    { key: 'm2', label: '1.5.0', version: '1.5.0', adrs: ['/calm/adrs/1'] },
    { key: 'm3', label: '2.0.0', version: '2.0.0' },
];

function renderBar(overrides?: {
    onNavigate?: () => void;
    onCompare?: () => void;
    currentVersion?: string;
    compareFrom?: string | null;
    compareTo?: string | null;
}) {
    const onNavigate = overrides?.onNavigate ?? vi.fn();
    const onCompare = overrides?.onCompare ?? vi.fn();
    const result = render(
        <TimelineBar
            moments={moments}
            currentVersion={overrides?.currentVersion ?? '1.5.0'}
            compareFrom={overrides?.compareFrom ?? null}
            compareTo={overrides?.compareTo ?? null}
            onNavigate={onNavigate}
            onCompare={onCompare}
        />
    );
    return { onNavigate, onCompare, ...result };
}

describe('TimelineBar', () => {
    beforeEach(() => localStorage.clear());

    it('renders the collapsed sparkline by default with all version dots, NEW pill and an expand chevron', () => {
        renderBar();
        expect(screen.getByTestId('timeline-bar-collapsed')).toBeInTheDocument();
        // Sparkline renders every moment as a dot with its label visible beneath.
        expect(screen.getByLabelText('Moment 1.0.0')).toBeInTheDocument();
        expect(screen.getByLabelText('Moment 1.5.0')).toBeInTheDocument();
        expect(screen.getByLabelText('Moment 2.0.0')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /expand timeline/i })).toBeInTheDocument();
        // Onboarding affordance is visible until the user has interacted at least once.
        expect(screen.getByTestId('timeline-new-pill')).toBeInTheDocument();
        // Expanded panel is not shown by default.
        expect(screen.queryByTestId('timeline-bar-expanded')).not.toBeInTheDocument();
    });

    it('dismisses the NEW pill after the user first expands the bar', () => {
        renderBar();
        expect(screen.getByTestId('timeline-new-pill')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /expand timeline/i }));
        expect(screen.queryByTestId('timeline-new-pill')).not.toBeInTheDocument();
    });

    it('persists that the user has seen the timeline across remounts', () => {
        const first = renderBar();
        // Right-click on a sparkline dot counts as an interaction.
        fireEvent.contextMenu(screen.getByLabelText('Moment 1.0.0'));
        first.unmount();

        renderBar();
        expect(screen.queryByTestId('timeline-new-pill')).not.toBeInTheDocument();
    });

    it('expands to show all moments when the chevron is clicked', () => {
        renderBar();
        fireEvent.click(screen.getByRole('button', { name: /expand timeline/i }));
        expect(screen.getByTestId('timeline-bar-expanded')).toBeInTheDocument();
        expect(screen.getByLabelText('Moment 1.0.0')).toBeInTheDocument();
        expect(screen.getByLabelText('Moment 1.5.0')).toBeInTheDocument();
        expect(screen.getByLabelText('Moment 2.0.0')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /collapse timeline/i })).toBeInTheDocument();
    });

    it('keeps the bar expanded across a remount (refresh)', () => {
        const { unmount } = renderBar();
        fireEvent.click(screen.getByRole('button', { name: /expand timeline/i }));
        expect(screen.getByTestId('timeline-bar-expanded')).toBeInTheDocument();
        unmount();

        renderBar();
        expect(screen.getByTestId('timeline-bar-expanded')).toBeInTheDocument();
    });

    it('highlights the current moment', () => {
        renderBar({ currentVersion: '1.5.0' });
        fireEvent.click(screen.getByRole('button', { name: /expand timeline/i }));
        const currentMarker = screen.getByLabelText('Moment 1.5.0');
        expect(currentMarker).toHaveAttribute('aria-current', 'true');
    });

    it('left-click on a moment card navigates to that moment', () => {
        const { onNavigate } = renderBar({ currentVersion: '1.5.0' });
        fireEvent.click(screen.getByRole('button', { name: /expand timeline/i }));
        fireEvent.click(screen.getByLabelText('Moment 2.0.0'));
        expect(onNavigate).toHaveBeenCalledWith('2.0.0');
    });

    it('left-click on the current moment still emits onNavigate so the parent can exit compare', () => {
        // The cards forward every click; the parent decides whether to actually
        // navigate. Clicking the current moment is the way users exit compare
        // mode when one of the compare endpoints is the current version.
        const { onNavigate } = renderBar({ currentVersion: '1.5.0' });
        fireEvent.click(screen.getByRole('button', { name: /expand timeline/i }));
        fireEvent.click(screen.getByLabelText('Moment 1.5.0'));
        expect(onNavigate).toHaveBeenCalledWith('1.5.0');
    });

    it('right-click opens a context menu', () => {
        renderBar();
        fireEvent.click(screen.getByRole('button', { name: /expand timeline/i }));
        fireEvent.contextMenu(screen.getByLabelText('Moment 1.0.0'));
        expect(screen.getByTestId('timeline-context-menu')).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: /compare from/i })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: /compare to/i })).toBeInTheDocument();
    });

    it('"Compare from" uses the moment as baseline and the current version as comparison', () => {
        const { onCompare } = renderBar({ currentVersion: '1.5.0' });
        fireEvent.click(screen.getByRole('button', { name: /expand timeline/i }));
        fireEvent.contextMenu(screen.getByLabelText('Moment 1.0.0'));
        fireEvent.click(screen.getByRole('menuitem', { name: /compare from/i }));
        // from = this moment (1.0.0), to = current (1.5.0)
        expect(onCompare).toHaveBeenCalledWith('1.0.0', '1.5.0');
        expect(screen.queryByTestId('timeline-context-menu')).not.toBeInTheDocument();
    });

    it('"Compare to" uses the current version as baseline and the moment as comparison', () => {
        const { onCompare } = renderBar({ currentVersion: '1.5.0' });
        fireEvent.click(screen.getByRole('button', { name: /expand timeline/i }));
        fireEvent.contextMenu(screen.getByLabelText('Moment 2.0.0'));
        fireEvent.click(screen.getByRole('menuitem', { name: /compare to/i }));
        // from = current (1.5.0), to = this moment (2.0.0)
        expect(onCompare).toHaveBeenCalledWith('1.5.0', '2.0.0');
    });

    it('closes the context menu on Escape', () => {
        renderBar();
        fireEvent.click(screen.getByRole('button', { name: /expand timeline/i }));
        fireEvent.contextMenu(screen.getByLabelText('Moment 1.0.0'));
        expect(screen.getByTestId('timeline-context-menu')).toBeInTheDocument();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByTestId('timeline-context-menu')).not.toBeInTheDocument();
    });

    it('closes the context menu on an outside click', () => {
        renderBar();
        fireEvent.click(screen.getByRole('button', { name: /expand timeline/i }));
        fireEvent.contextMenu(screen.getByLabelText('Moment 1.0.0'));
        expect(screen.getByTestId('timeline-context-menu')).toBeInTheDocument();
        fireEvent.mouseDown(document.body);
        expect(screen.queryByTestId('timeline-context-menu')).not.toBeInTheDocument();
    });

    it('marks the compared moments with FROM and TO badges on the expanded cards', () => {
        renderBar({ currentVersion: '1.5.0', compareFrom: '1.0.0', compareTo: '2.0.0' });
        fireEvent.click(screen.getByRole('button', { name: /expand timeline/i }));
        expect(screen.getByText('FROM')).toBeInTheDocument();
        expect(screen.getByText('TO')).toBeInTheDocument();
    });
});
