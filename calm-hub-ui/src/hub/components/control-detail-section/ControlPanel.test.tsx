import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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

function renderPanel(props = controlData) {
    return render(
        <MemoryRouter>
            <ControlPanel controlData={props} />
        </MemoryRouter>,
    );
}

describe('ControlPanel', () => {
    it('renders a breadcrumb back to Explore and the domain control list', () => {
        renderPanel();
        expect(screen.getByRole('link', { name: 'Explore' })).toHaveAttribute('href', '/');
        expect(screen.getByRole('link', { name: 'security' })).toHaveAttribute(
            'href',
            '/domain/security',
        );
    });

    it('shows the control name as the heading', () => {
        renderPanel();
        expect(screen.getByRole('heading', { name: 'Encryption' })).toBeInTheDocument();
    });

    it('prefers the control title over the name', () => {
        renderPanel({ ...controlData, controlTitle: 'Pretty Title' });
        expect(screen.getByRole('heading', { name: 'Pretty Title' })).toBeInTheDocument();
        expect(screen.queryByText('Encryption')).not.toBeInTheDocument();
    });

    it('shows a single readable/raw toggle in the header, defaulting to readable', () => {
        renderPanel();
        expect(screen.getByRole('tab', { name: 'Readable' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('tab', { name: 'Raw JSON' })).toHaveAttribute('aria-selected', 'false');
    });

    it('switches the view mode from the header toggle', () => {
        renderPanel();
        fireEvent.click(screen.getByRole('tab', { name: 'Raw JSON' }));
        expect(screen.getByRole('tab', { name: 'Raw JSON' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('tab', { name: 'Readable' })).toHaveAttribute('aria-selected', 'false');
    });
});
