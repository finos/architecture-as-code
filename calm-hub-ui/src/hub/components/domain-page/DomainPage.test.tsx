import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DomainPage } from './DomainPage.js';

const fetchControlsForDomain = vi.fn();

vi.mock('../../../service/control-service.js', () => ({
    ControlService: vi.fn().mockImplementation(function () { return ({
        fetchControlsForDomain,
    }); }),
}));

const LocationProbe = () => {
    const location = useLocation();
    return <div data-testid="location">{location.pathname}{location.search}</div>;
};

const renderPage = (controlCount = 2, domain = 'security') =>
    render(
        <MemoryRouter>
            <DomainPage domain={domain} controlCount={controlCount} />
            <LocationProbe />
        </MemoryRouter>
    );

beforeEach(() => {
    vi.clearAllMocks();
    fetchControlsForDomain.mockResolvedValue([
        { id: '5', name: 'Encryption', description: 'Encrypt data' },
        { id: '6', name: 'Access Control', description: 'Limit access' },
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

    it('navigates to the control deep link when a control is clicked', async () => {
        renderPage();

        fireEvent.click(await screen.findByText('Encryption'));

        expect(screen.getByTestId('location')).toHaveTextContent('/security/controls/5/detail');
    });

    it('encodes the domain in the control deep link', async () => {
        renderPage(2, 'my domain');

        fireEvent.click(await screen.findByText('Encryption'));

        expect(screen.getByTestId('location')).toHaveTextContent('/my%20domain/controls/5/detail');
    });

    it('gives controls that share a stem distinct deep links', async () => {
        fetchControlsForDomain.mockResolvedValue([
            { id: 'auth', name: 'auth', title: 'Prod auth', tags: { path: 'security', variant: '' } },
            { id: 'auth', name: 'auth', title: 'Legacy auth', tags: { path: 'security/legacy', variant: '' } },
            { id: 'auth', name: 'auth', title: 'Auth v2', tags: { path: 'security', variant: 'v2' } },
        ]);
        renderPage(3);

        const cards = await screen.findAllByTestId('control-card');
        expect(cards).toHaveLength(3);
        expect(cards[0]).toHaveAttribute('href', '/security/controls/auth/detail?path=security&variant=');
        expect(cards[1]).toHaveAttribute('href', '/security/controls/auth/detail?path=security%2Flegacy&variant=');
        expect(cards[2]).toHaveAttribute('href', '/security/controls/auth/detail?path=security&variant=v2');
    });

    it('shows an empty message when the domain has no controls', async () => {
        fetchControlsForDomain.mockResolvedValue([]);
        renderPage(0);
        expect(await screen.findByText('No controls in this domain yet.')).toBeInTheDocument();
    });

    it('clears the old controls and then lists the new ones when the domain changes', async () => {
        const { rerender } = renderPage(2, 'security');
        expect(await screen.findByText('Encryption')).toBeInTheDocument();

        let resolveNext: (value: unknown) => void = () => undefined;
        fetchControlsForDomain.mockReturnValueOnce(new Promise((resolve) => { resolveNext = resolve; }));
        rerender(
            <MemoryRouter>
                <DomainPage domain="privacy" controlCount={1} />
                <LocationProbe />
            </MemoryRouter>
        );
        expect(screen.queryByText('Encryption')).not.toBeInTheDocument();

        await act(async () => resolveNext([{ id: '9', name: 'Data Retention', description: 'Keep data briefly' }]));
        expect(screen.getByText('Data Retention')).toBeInTheDocument();
        expect(fetchControlsForDomain).toHaveBeenLastCalledWith('privacy');
    });
});
