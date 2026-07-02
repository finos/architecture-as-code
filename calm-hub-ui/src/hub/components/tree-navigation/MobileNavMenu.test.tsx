import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useNavigate, useParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi, Mock } from 'vitest';
import { MobileNavMenu } from './MobileNavMenu.js';
import type { NamespaceCounts, DomainControlCount } from '../../../model/counts.js';

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

// Counts are owned by Hub and passed in as props; the menu no longer fetches them.
const namespaceCounts = [
    { namespace: 'finos', architectures: 4, patterns: 0, flows: 0, standards: 0, adrs: 0, interfaces: 0, total: 4 },
    { namespace: 'traderx', architectures: 2, patterns: 0, flows: 4, standards: 0, adrs: 0, interfaces: 3, total: 9 },
] as NamespaceCounts[];
const domainCounts: DomainControlCount[] = [{ domain: 'security', controlCount: 7 }];

const props = {
    namespaceCounts,
    domainCounts,
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

    it('shows a mono count badge on each namespace row', async () => {
        renderMenu();
        fireEvent.click(screen.getByText('Namespaces'));
        expect(await screen.findByText('traderx')).toBeInTheDocument();

        const badges = await screen.findAllByTestId('count-badge');
        const badgeText = badges.map((b) => b.textContent);
        expect(badgeText).toContain('4');
        expect(badgeText).toContain('9');
    });

    it('shows per-type count badges at the resource-type level, dimming zeros', async () => {
        renderMenu();
        fireEvent.click(screen.getByText('Namespaces'));
        fireEvent.click(await screen.findByText('traderx'));
        expect(await screen.findByText('Architectures')).toBeInTheDocument();

        // traderx: architectures 2, flows 4, interfaces 3, and three zeros.
        const badges = screen.getAllByTestId('count-badge');
        const texts = badges.map((b) => b.textContent);
        expect(texts).toEqual(['2', '0', '4', '0', '0', '3']);

        // Zero-count badges are dimmed (faint bg), matching the desktop type tabs.
        const zeroBadge = badges.find((b) => b.textContent === '0')!;
        expect(zeroBadge).toHaveStyle({ backgroundColor: '#F4F6F9' });
    });

    it('shows a count badge on each control-domain row', async () => {
        renderMenu();
        fireEvent.click(screen.getByText('Control Domains'));
        expect(await screen.findByText('security')).toBeInTheDocument();

        const badge = await screen.findByTestId('count-badge');
        expect(badge).toHaveTextContent('7');
    });

    it('applies the active tint to the namespace row matching the URL', async () => {
        (useParams as Mock).mockReturnValue({ ns: 'traderx' });
        renderMenu();
        fireEvent.click(screen.getByText('Namespaces'));

        const activeRow = (await screen.findByText('traderx')).closest('button')!;
        expect(activeRow).toHaveStyle({ backgroundColor: '#EEF4FF' });
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
});
