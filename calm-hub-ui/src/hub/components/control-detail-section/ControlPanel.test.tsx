import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ControlPanel } from './ControlPanel.js';

// ControlDetailSection (wrapped by the panel) fetches via ControlService on mount;
// stub it so the panel renders without real network calls.
vi.mock('../../../service/control-service.js', () => ({
    ControlService: vi.fn().mockImplementation(function () {
        return {
            fetchRequirementVersions: vi.fn().mockResolvedValue([]),
            fetchConfigurationsForControl: vi.fn().mockResolvedValue([]),
            fetchRequirementForVersion: vi.fn().mockResolvedValue({}),
            fetchConfigurationVersions: vi.fn().mockResolvedValue([]),
            fetchConfigurationForVersion: vi.fn().mockResolvedValue({}),
        };
    }),
}));

const controlData = {
    domain: 'security',
    controlId: 5,
    controlName: 'Encryption',
    controlDescription: 'Encrypt data',
};

describe('ControlPanel', () => {
    it('renders Sidebar-style chrome with a close affordance', () => {
        render(<ControlPanel controlData={controlData} onClose={vi.fn()} />);
        expect(screen.getByRole('heading', { name: /control/i })).toBeInTheDocument();
        expect(screen.getByLabelText('Close control details')).toBeInTheDocument();
    });

    it('calls onClose when the close button is clicked', () => {
        const onClose = vi.fn();
        render(<ControlPanel controlData={controlData} onClose={onClose} />);
        fireEvent.click(screen.getByLabelText('Close control details'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('shows a single readable/raw toggle in the title bar, defaulting to readable', () => {
        render(<ControlPanel controlData={controlData} onClose={vi.fn()} />);
        // The controlled section hides its per-panel toggles, so these are the only
        // Readable/Raw tabs — and they live in the title bar (one toggle each).
        expect(screen.getByRole('tab', { name: 'Readable' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('tab', { name: 'Raw JSON' })).toHaveAttribute('aria-selected', 'false');
    });

    it('switches the view mode from the title-bar toggle', () => {
        render(<ControlPanel controlData={controlData} onClose={vi.fn()} />);
        fireEvent.click(screen.getByRole('tab', { name: 'Raw JSON' }));
        expect(screen.getByRole('tab', { name: 'Raw JSON' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('tab', { name: 'Readable' })).toHaveAttribute('aria-selected', 'false');
    });
});
