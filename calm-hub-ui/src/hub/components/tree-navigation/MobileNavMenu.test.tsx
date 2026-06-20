import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useNavigate, useParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi, Mock } from 'vitest';
import { MobileNavMenu } from './MobileNavMenu.js';

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useParams: vi.fn().mockReturnValue({}),
        useNavigate: vi.fn(),
    };
});

// Stub the explorer search so it doesn't instantiate real services during these
// drill-down tests.
vi.mock('../../../components/navbar/ExplorerSearch.js', () => ({
    ExplorerSearch: () => <div data-testid="explorer-search" />,
}));

vi.mock('../../../service/calm-service.js', () => ({
    CalmService: vi.fn().mockImplementation(function () { return ({
        fetchNamespaces: vi.fn().mockResolvedValue(['finos', 'traderx']),
        fetchArchitectureSummaries: vi.fn().mockResolvedValue([{ id: 1, name: 'Arch One' }]),
        fetchPatternSummaries: vi.fn().mockResolvedValue([]),
        fetchFlowSummaries: vi.fn().mockResolvedValue([]),
        fetchStandardSummaries: vi.fn().mockResolvedValue([]),
        fetchArchitectureVersions: vi.fn().mockResolvedValue(['1.0.0']),
        fetchPatternVersions: vi.fn().mockResolvedValue([]),
        fetchFlowVersions: vi.fn().mockResolvedValue([]),
        fetchStandardVersions: vi.fn().mockResolvedValue([]),
        fetchArchitecture: vi.fn().mockResolvedValue({}),
        fetchVersionsByCustomId: vi.fn().mockResolvedValue([]),
        fetchResourceByCustomId: vi.fn().mockResolvedValue({}),
    }); }),
}));

vi.mock('../../../service/control-service.js', () => ({
    ControlService: vi.fn().mockImplementation(function () { return ({
        fetchDomains: vi.fn().mockResolvedValue(['security']),
        fetchControlsForDomain: vi.fn().mockResolvedValue([{ id: 5, name: 'Encryption', description: 'Encrypt data' }]),
    }); }),
}));

vi.mock('../../../service/interface-service.js', () => ({
    InterfaceService: vi.fn().mockImplementation(function () { return ({
        fetchInterfacesForNamespace: vi.fn().mockResolvedValue([]),
    }); }),
}));

vi.mock('../../../service/adr-service/adr-service.js', () => ({
    AdrService: vi.fn().mockImplementation(function () { return ({
        fetchAdrSummaries: vi.fn().mockResolvedValue([]),
        fetchAdrRevisions: vi.fn().mockResolvedValue([]),
        fetchAdr: vi.fn().mockResolvedValue({}),
    }); }),
}));

const props = {
    onDataLoad: vi.fn(),
    onAdrLoad: vi.fn(),
    onControlLoad: vi.fn(),
    onInterfaceLoad: vi.fn(),
    onClose: vi.fn(),
};

const renderMenu = () =>
    render(
        <MemoryRouter>
            <MobileNavMenu {...props} />
        </MemoryRouter>
    );

beforeEach(() => {
    vi.clearAllMocks();
    (useParams as Mock).mockReturnValue({});
    (useNavigate as Mock).mockReturnValue(vi.fn());
});

describe('MobileNavMenu', () => {
    it('renders the root level with Namespaces and Control Domains', () => {
        renderMenu();
        expect(screen.getByRole('heading', { name: 'Explore' })).toBeInTheDocument();
        expect(screen.getByText('Namespaces')).toBeInTheDocument();
        expect(screen.getByText('Control Domains')).toBeInTheDocument();
        // No back button at the root.
        expect(screen.queryByLabelText('Back')).not.toBeInTheDocument();
    });

    it('drills into namespaces and shows resource types', async () => {
        renderMenu();
        fireEvent.click(screen.getByText('Namespaces'));
        expect(await screen.findByText('traderx')).toBeInTheDocument();

        fireEvent.click(screen.getByText('traderx'));
        // Resource types level
        expect(await screen.findByText('Architectures')).toBeInTheDocument();
        expect(screen.getByText('Interfaces')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'traderx' })).toBeInTheDocument();
    });

    it('navigates to a resource and closes when a leaf is selected', async () => {
        const navigate = vi.fn();
        (useNavigate as Mock).mockReturnValue(navigate);
        renderMenu();

        fireEvent.click(screen.getByText('Namespaces'));
        fireEvent.click(await screen.findByText('traderx'));
        fireEvent.click(await screen.findByText('Architectures'));
        fireEvent.click(await screen.findByText('Arch One'));

        await waitFor(() => {
            expect(navigate).toHaveBeenCalledWith('/traderx/architectures/1/1.0.0');
        });
        expect(props.onClose).toHaveBeenCalled();
    });

    it('drills into control domains and lists controls', async () => {
        renderMenu();
        fireEvent.click(screen.getByText('Control Domains'));
        fireEvent.click(await screen.findByText('security'));
        expect(await screen.findByText('Encryption')).toBeInTheDocument();
    });

    it('goes back up a level with the back button', async () => {
        renderMenu();
        fireEvent.click(screen.getByText('Namespaces'));
        fireEvent.click(await screen.findByText('traderx'));
        expect(await screen.findByText('Architectures')).toBeInTheDocument();

        fireEvent.click(screen.getByLabelText('Back'));
        // Back to the namespaces list
        expect(await screen.findByText('traderx')).toBeInTheDocument();
        expect(screen.queryByText('Architectures')).not.toBeInTheDocument();
    });

    it('loads a resource from a deep-link via URL params', async () => {
        (useParams as Mock).mockReturnValue({
            namespace: 'traderx',
            type: 'architectures',
            id: '1',
            version: '1.0.0',
        });
        renderMenu();
        await waitFor(() => {
            expect(props.onDataLoad).toHaveBeenCalled();
        });
    });
});
