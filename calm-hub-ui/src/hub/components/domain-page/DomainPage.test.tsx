import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DomainPage } from './DomainPage.js';

const fetchControlsForDomain = vi.fn();

vi.mock('../../../service/control-service.js', () => ({
    ControlService: vi.fn().mockImplementation(function () { return ({
        fetchControlsForDomain,
    }); }),
}));

const renderPage = (controlCount = 2, onControlLoad = vi.fn(), selectedControlId?: number) =>
    render(
        <MemoryRouter>
            <DomainPage
                domain="security"
                controlCount={controlCount}
                onControlLoad={onControlLoad}
                selectedControlId={selectedControlId}
            />
        </MemoryRouter>
    );

beforeEach(() => {
    vi.clearAllMocks();
    fetchControlsForDomain.mockResolvedValue([
        { id: 5, name: 'Encryption', description: 'Encrypt data' },
        { id: 6, name: 'Access Control', description: 'Limit access' },
    ]);
});

describe('DomainPage', () => {
    it('renders the breadcrumb, domain header and control count meta', async () => {
        renderPage(2);
        expect(screen.getByText('Explore')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'security' })).toBeInTheDocument();
        expect(screen.getByText('2 controls')).toBeInTheDocument();
        await screen.findByText('Encryption');
    });

    it('uses the singular control label when the count is 1', async () => {
        renderPage(1);
        expect(screen.getByText('1 control')).toBeInTheDocument();
        await screen.findByText('Encryption');
    });

    it('lists the domain controls', async () => {
        renderPage();
        expect(await screen.findByText('Encryption')).toBeInTheDocument();
        expect(screen.getByText('Access Control')).toBeInTheDocument();
    });

    it('marks the selected control card as active', async () => {
        renderPage(2, vi.fn(), 5);
        const selected = await screen.findByText('Encryption');
        expect(selected).toHaveAttribute('aria-pressed', 'true');
        // The other card is not selected.
        expect(screen.getByText('Access Control')).toHaveAttribute('aria-pressed', 'false');
    });

    it('loads a control via onControlLoad when a control is clicked', async () => {
        const onControlLoad = vi.fn();
        renderPage(2, onControlLoad);

        fireEvent.click(await screen.findByText('Encryption'));

        expect(onControlLoad).toHaveBeenCalledWith({
            domain: 'security',
            controlId: 5,
            controlName: 'Encryption',
            controlDescription: 'Encrypt data',
        });
    });

    it('shows an empty message when the domain has no controls', async () => {
        fetchControlsForDomain.mockResolvedValue([]);
        renderPage(0);
        expect(await screen.findByText('No controls in this domain yet.')).toBeInTheDocument();
    });
});
