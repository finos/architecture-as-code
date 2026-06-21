import { render, screen, fireEvent, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { MobileTimeline } from './MobileTimeline.js';
import type { TimelineMoment } from './TimelineBar.js';

const moments: TimelineMoment[] = [
    { key: 'm1', label: '1.0.0', version: '1.0.0', validFrom: '2025-01-01' },
    { key: 'm2', label: '1.5.0', version: '1.5.0', validFrom: '2025-06-01' },
    { key: 'm3', label: '2.0.0', version: '2.0.0', validFrom: '2025-09-01' },
];

function renderTimeline(overrides?: Partial<ComponentProps<typeof MobileTimeline>>) {
    const onNavigate = overrides?.onNavigate ?? vi.fn();
    const onClose = overrides?.onClose ?? vi.fn();
    const result = render(
        <MobileTimeline
            moments={moments}
            currentVersion="1.5.0"
            displayName="CALM Platform"
            loadChangesForVersion={async () => []}
            onNavigate={onNavigate}
            onClose={onClose}
            {...overrides}
        />
    );
    return { onNavigate, onClose, ...result };
}

describe('MobileTimeline', () => {
    it('shows the currently-viewed moment with a forward chevron when more moments exist', () => {
        renderTimeline();
        const current = screen.getByTestId('mobile-timeline-current');
        expect(within(current).getByText('1.5.0')).toBeInTheDocument();
        // The chevron row is enabled (clickable) because there is more than one moment.
        expect(current).toBeEnabled();
        expect(within(current).getByText('3')).toBeInTheDocument();
    });

    it('does not offer the drill-down when only one moment exists', () => {
        renderTimeline({ moments: [moments[0]], currentVersion: '1.0.0' });
        expect(screen.getByTestId('mobile-timeline-current')).toBeDisabled();
    });

    it('pushes the all-versions list (newest first) when the current moment is tapped', () => {
        renderTimeline();
        fireEvent.click(screen.getByTestId('mobile-timeline-current'));

        const list = screen.getByTestId('mobile-timeline-list');
        const rows = within(list).getAllByRole('button');
        // Newest first: 2.0.0, 1.5.0, 1.0.0.
        expect(rows[0]).toHaveTextContent('2.0.0');
        expect(rows[2]).toHaveTextContent('1.0.0');
        expect(screen.getByText('All versions')).toBeInTheDocument();
    });

    it('marks the currently-viewed version as current in the list', () => {
        renderTimeline();
        fireEvent.click(screen.getByTestId('mobile-timeline-current'));
        expect(screen.getByLabelText('Select version 1.5.0')).toHaveAttribute('aria-current', 'true');
    });

    it('navigates to a version and returns to the detail level when a row is selected', () => {
        const { onNavigate } = renderTimeline();
        fireEvent.click(screen.getByTestId('mobile-timeline-current'));
        fireEvent.click(screen.getByLabelText('Select version 2.0.0'));

        expect(onNavigate).toHaveBeenCalledWith('2.0.0');
        // Popped back to the detail level.
        expect(screen.queryByTestId('mobile-timeline-list')).not.toBeInTheDocument();
        expect(screen.getByTestId('mobile-timeline-current')).toBeInTheDocument();
    });

    it('shows the NOW badge against the timeline current-moment on an explicit timeline', () => {
        renderTimeline({ timelineIsExplicit: true, timelineCurrentMomentId: 'm2' });
        expect(screen.getByText('NOW')).toBeInTheDocument();
    });

    it('omits the NOW badge for an implied (non-explicit) timeline', () => {
        renderTimeline({ timelineIsExplicit: false, timelineCurrentMomentId: 'm2' });
        expect(screen.queryByText('NOW')).not.toBeInTheDocument();
    });

    it('closes the sheet when the close button is pressed', () => {
        const { onClose } = renderTimeline();
        fireEvent.click(screen.getByLabelText('Close timeline'));
        expect(onClose).toHaveBeenCalled();
    });

    it('goes back from the list to the detail level', () => {
        renderTimeline();
        fireEvent.click(screen.getByTestId('mobile-timeline-current'));
        expect(screen.getByTestId('mobile-timeline-list')).toBeInTheDocument();
        fireEvent.click(screen.getByLabelText('Back'));
        expect(screen.queryByTestId('mobile-timeline-list')).not.toBeInTheDocument();
    });
});
