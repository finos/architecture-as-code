import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TreeNavigation, buildNamespaceTree } from './TreeNavigation.js';
import { CalmService } from '../../../service/calm-service.js';
import { ControlService } from '../../../service/control-service.js';
import { InterfaceService } from '../../../service/interface-service.js';
import { MemoryRouter, useParams, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi, Mock } from 'vitest';
import { authStore } from '../../../service/utils/auth-store.js';

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useParams: vi.fn().mockReturnValue({}),
        useNavigate: vi.fn(),
    };
});

let calmServiceInstance: {
    fetchNamespaces: Mock;
    fetchPatternSummaries: Mock;
    fetchFlowSummaries: Mock;
    fetchStandardSummaries: Mock;
    fetchArchitectureSummaries: Mock;
    fetchPatternVersions: Mock;
    fetchFlowVersions: Mock;
    fetchStandardVersions: Mock;
    fetchArchitectureVersions: Mock;
    fetchPattern: Mock;
    fetchFlow: Mock;
    fetchStandard: Mock;
    fetchArchitecture: Mock;
    fetchMappings: Mock;
    fetchVersionsByCustomId: Mock;
    fetchResourceByCustomId: Mock;
} | undefined;

vi.mock('../../../service/calm-service.js', () => ({
    CalmService: vi.fn().mockImplementation(function () {
        calmServiceInstance = {
            fetchNamespaces: vi.fn().mockResolvedValue(['test-namespace', 'another-namespace']),
            fetchPatternSummaries: vi.fn().mockResolvedValue([]),
            fetchFlowSummaries: vi.fn().mockResolvedValue([]),
            fetchStandardSummaries: vi.fn().mockResolvedValue([]),
            fetchArchitectureSummaries: vi.fn().mockResolvedValue([]),
            fetchPatternVersions: vi.fn().mockResolvedValue([]),
            fetchFlowVersions: vi.fn().mockResolvedValue([]),
            fetchStandardVersions: vi.fn().mockResolvedValue([]),
            fetchArchitectureVersions: vi.fn().mockResolvedValue([]),
            fetchPattern: vi.fn().mockResolvedValue({}),
            fetchFlow: vi.fn().mockResolvedValue({}),
            fetchStandard: vi.fn().mockResolvedValue({}),
            fetchArchitecture: vi.fn().mockResolvedValue({}),
            fetchMappings: vi.fn().mockResolvedValue([]),
            fetchVersionsByCustomId: vi.fn().mockResolvedValue([]),
            fetchResourceByCustomId: vi.fn().mockResolvedValue({})
        };
        return calmServiceInstance;
    })
}));

let controlServiceInstance: {
    fetchDomains: Mock;
    fetchControlsForDomain: Mock;
} | undefined;

vi.mock('../../../service/control-service.js', () => ({
    ControlService: vi.fn().mockImplementation(function () {
        controlServiceInstance = {
            fetchDomains: vi.fn().mockResolvedValue(['test-domain']),
            fetchControlsForDomain: vi.fn().mockResolvedValue([]),
        };
        return controlServiceInstance;
    }),
}));

let interfaceServiceInstance: {
    fetchInterfacesForNamespace: Mock;
} | undefined;

vi.mock('../../../service/interface-service.js', () => ({
    InterfaceService: vi.fn().mockImplementation(function () {
        interfaceServiceInstance = {
            fetchInterfacesForNamespace: vi.fn().mockResolvedValue([]),
        };
        return interfaceServiceInstance;
    }),
}));

let adrServiceInstance: {
    fetchAdrSummaries: Mock;
    fetchAdrRevisions: Mock;
    fetchAdr: Mock;
} | undefined;
vi.mock('../../../service/adr-service/adr-service.js', () => ({
    AdrService: vi.fn().mockImplementation(function () {
        adrServiceInstance = {
            fetchAdrSummaries: vi.fn().mockResolvedValue([{ id: 201, title: 'Use CALM', status: 'accepted' }, { id: 202, title: 'Use React', status: 'proposed' }]),
            fetchAdrRevisions: vi.fn().mockResolvedValue(['v1.0', 'v2.0']),
            fetchAdr: vi.fn().mockResolvedValue({})
        };
        return adrServiceInstance;
    })
}));

const mockProps = {
    onDataLoad: vi.fn(),
    onAdrLoad: vi.fn(),
    onControlLoad: vi.fn(),
    onInterfaceLoad: vi.fn()
};

// Override the next CalmService instance so fetchNamespaces returns a specific set;
// all other methods resolve empty so the tree renders without further fetches.
function mockCalmServiceWithNamespaces(namespaces: string[]) {
    vi.mocked(CalmService).mockImplementationOnce(function () { return {
        fetchNamespaces: vi.fn().mockResolvedValue(namespaces),
        fetchPatternSummaries: vi.fn().mockResolvedValue([]),
        fetchFlowSummaries: vi.fn().mockResolvedValue([]),
        fetchStandardSummaries: vi.fn().mockResolvedValue([]),
        fetchArchitectureSummaries: vi.fn().mockResolvedValue([]),
        fetchPatternVersions: vi.fn().mockResolvedValue([]),
        fetchFlowVersions: vi.fn().mockResolvedValue([]),
        fetchStandardVersions: vi.fn().mockResolvedValue([]),
        fetchArchitectureVersions: vi.fn().mockResolvedValue([]),
        fetchPattern: vi.fn().mockResolvedValue({}),
        fetchFlow: vi.fn().mockResolvedValue({}),
        fetchStandard: vi.fn().mockResolvedValue({}),
        fetchArchitecture: vi.fn().mockResolvedValue({}),
        fetchMappings: vi.fn().mockResolvedValue([]),
        fetchVersionsByCustomId: vi.fn().mockResolvedValue([]),
        fetchResourceByCustomId: vi.fn().mockResolvedValue({}),
    }; } as unknown as InstanceType<typeof CalmService>);
}

describe('TreeNavigation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        authStore.setAuthError(null);
    });

    it('renders the tree navigation component', async () => {
        render(<MemoryRouter initialEntries={["/"]}>
            <TreeNavigation {...mockProps} />
        </MemoryRouter>);

        expect(screen.getByText('Namespaces')).toBeInTheDocument();
        expect(screen.getByText('Control Domains')).toBeInTheDocument();
        const testNamespaces = await screen.findAllByText('test-namespace');
        expect(testNamespaces).toHaveLength(1);
        expect(screen.getByText('another-namespace')).toBeInTheDocument();
        expect(screen.getByText('test-domain')).toBeInTheDocument();
    });

    it('shows resource types only when namespace is selected', async () => {
        render(<MemoryRouter initialEntries={["/"]}>
            <TreeNavigation {...mockProps} />
        </MemoryRouter>);

        // Wait for namespaces to load
        await screen.findByText('test-namespace');

        // Resource types should not be visible since no namespace is selected
        expect(screen.queryByText('Architectures')).not.toBeInTheDocument();
        expect(screen.queryByText('Patterns')).not.toBeInTheDocument();
        expect(screen.queryByText('Flows')).not.toBeInTheDocument();
        expect(screen.queryByText('ADRs')).not.toBeInTheDocument();
    });

    it('handles initial state correctly', async () => {
        render(<MemoryRouter initialEntries={["/"]}>
            <TreeNavigation {...mockProps} />
        </MemoryRouter>);

        expect(screen.getByText('Namespaces')).toBeInTheDocument();
        const testNamespaces = await screen.findAllByText('test-namespace');
        expect(testNamespaces).toHaveLength(1);
        expect(screen.getByText('another-namespace')).toBeInTheDocument();
    });

    it('loads data based on deeplink route - pattern', async () => {
        vi.mocked(useParams).mockReturnValue({
            namespace: 'test-namespace',
            type: 'patterns',
            id: '102',
            version: 'v2.0'
        });

        render(<MemoryRouter initialEntries={["/"]}>
            <TreeNavigation {...mockProps} />
        </MemoryRouter>);

        await waitFor(() => {
            expect(calmServiceInstance?.fetchNamespaces).toHaveBeenCalled();
            expect(calmServiceInstance?.fetchPatternSummaries).toHaveBeenCalledWith('test-namespace');
            expect(calmServiceInstance?.fetchPattern).toHaveBeenCalledWith('test-namespace', '102', 'v2.0');
        });
    });

    it('loads data based on deeplink route - architecture', async () => {
        vi.mocked(useParams).mockReturnValue({
            namespace: 'test-namespace',
            type: 'architectures',
            id: '201',
            version: 'v2.0'
        });

        render(<MemoryRouter initialEntries={["/"]}>
            <TreeNavigation {...mockProps} />
        </MemoryRouter>);

        await waitFor(() => {
            expect(calmServiceInstance?.fetchNamespaces).toHaveBeenCalled();
            expect(calmServiceInstance?.fetchArchitectureSummaries).toHaveBeenCalledWith('test-namespace');
            expect(calmServiceInstance?.fetchArchitecture).toHaveBeenCalledWith('test-namespace', '201', 'v2.0');
        });
    });

    it('loads data based on deeplink route - flow', async () => {
        vi.mocked(useParams).mockReturnValue({
            namespace: 'test-namespace',
            type: 'flows',
            id: '201',
            version: 'v2.0'
        });

        render(<MemoryRouter initialEntries={["/"]}>
            <TreeNavigation {...mockProps} />
        </MemoryRouter>);

        await waitFor(() => {
            expect(calmServiceInstance?.fetchNamespaces).toHaveBeenCalled();
            expect(calmServiceInstance?.fetchFlowSummaries).toHaveBeenCalledWith('test-namespace');
            expect(calmServiceInstance?.fetchFlow).toHaveBeenCalledWith('test-namespace', '201', 'v2.0');
        });
    });

    it('loads data based on deeplink route - ADR', async () => {
        vi.mocked(useParams).mockReturnValue({
            namespace: 'test-namespace',
            type: 'adrs',
            id: '201',
            version: 'v2.0'
        });

        render(<MemoryRouter initialEntries={["/"]}>
            <TreeNavigation {...mockProps} />
        </MemoryRouter>);

        await waitFor(() => {
            expect(adrServiceInstance?.fetchAdrSummaries).toHaveBeenCalledWith('test-namespace');
            expect(adrServiceInstance?.fetchAdr).toHaveBeenCalledWith('test-namespace', '201', 'v2.0');
        });
    });

    it('loads data based on deeplink route - interface', async () => {
        vi.mocked(InterfaceService).mockImplementation(function () {
            interfaceServiceInstance = {
                fetchInterfacesForNamespace: vi.fn().mockResolvedValue([
                    { id: 301, name: 'Test Interface', description: 'An interface' },
                ]),
            };
            return interfaceServiceInstance as unknown as InstanceType<typeof InterfaceService>;
        });

        vi.mocked(useParams).mockReturnValue({
            namespace: 'test-namespace',
            type: 'interfaces',
            id: '301',
            version: 'detail',
        });

        render(<MemoryRouter initialEntries={["/"]}>
            <TreeNavigation {...mockProps} />
        </MemoryRouter>);

        await waitFor(() => {
            expect(interfaceServiceInstance?.fetchInterfacesForNamespace).toHaveBeenCalledWith('test-namespace');
            expect(mockProps.onInterfaceLoad).toHaveBeenCalledWith({
                namespace: 'test-namespace',
                interfaceId: 301,
                interfaceName: 'Test Interface',
                interfaceDescription: 'An interface',
            });
        });
    });

    it('loads data based on deeplink route - control', async () => {
        vi.mocked(ControlService).mockImplementation(function () {
            controlServiceInstance = {
                fetchDomains: vi.fn().mockResolvedValue(['test-domain']),
                fetchControlsForDomain: vi.fn().mockResolvedValue([
                    { id: 401, name: 'Test Control', description: 'A control' },
                ]),
            };
            return controlServiceInstance as unknown as InstanceType<typeof ControlService>;
        });

        vi.mocked(useParams).mockReturnValue({
            namespace: 'test-domain',
            type: 'controls',
            id: '401',
            version: 'detail',
        });

        render(<MemoryRouter initialEntries={["/"]}>
            <TreeNavigation {...mockProps} />
        </MemoryRouter>);

        await waitFor(() => {
            expect(controlServiceInstance?.fetchControlsForDomain).toHaveBeenCalledWith('test-domain');
            expect(mockProps.onControlLoad).toHaveBeenCalledWith({
                domain: 'test-domain',
                controlId: 401,
                controlName: 'Test Control',
                controlDescription: 'A control',
            });
        });
    });

    it('navigates to the latest version when a resource is clicked', async () => {
        vi.mocked(useParams).mockReturnValue({});
        const navigate = vi.fn();
        vi.mocked(useNavigate).mockReturnValue(navigate);
        vi.mocked(CalmService).mockImplementationOnce(function () { return {
            fetchNamespaces: vi.fn().mockResolvedValue(['test-namespace']),
            fetchPatternSummaries: vi.fn().mockResolvedValue([]),
            fetchFlowSummaries: vi.fn().mockResolvedValue([]),
            fetchStandardSummaries: vi.fn().mockResolvedValue([]),
            fetchArchitectureSummaries: vi.fn().mockResolvedValue([{ id: 201, name: 'arch-a', description: '' }]),
            fetchPatternVersions: vi.fn().mockResolvedValue([]),
            fetchFlowVersions: vi.fn().mockResolvedValue([]),
            fetchStandardVersions: vi.fn().mockResolvedValue([]),
            fetchArchitectureVersions: vi.fn().mockResolvedValue(['1.0.0', '2.0.0', '1.5.0']),
            fetchPattern: vi.fn().mockResolvedValue({}),
            fetchFlow: vi.fn().mockResolvedValue({}),
            fetchStandard: vi.fn().mockResolvedValue({}),
            fetchArchitecture: vi.fn().mockResolvedValue({}),
            fetchMappings: vi.fn().mockResolvedValue([]),
            fetchVersionsByCustomId: vi.fn().mockResolvedValue([]),
            fetchResourceByCustomId: vi.fn().mockResolvedValue({}),
        }; } as unknown as InstanceType<typeof CalmService>);

        render(<MemoryRouter initialEntries={["/"]}>
            <TreeNavigation {...mockProps} />
        </MemoryRouter>);

        fireEvent.click(await screen.findByText('test-namespace'));
        fireEvent.click(await screen.findByText('Architectures'));
        fireEvent.click(await screen.findByText('arch-a'));

        await waitFor(() => {
            expect(navigate).toHaveBeenCalledWith('/test-namespace/architectures/201/2.0.0');
        });
    });

    it('keeps the parent namespace open when a child sub-namespace is collapsed', async () => {
        vi.mocked(useParams).mockReturnValue({});
        // 'a' is a real namespace that also contains the sub-namespaces 'a.b' and 'a.c'
        mockCalmServiceWithNamespaces(['a', 'a.b', 'a.c']);

        render(<MemoryRouter initialEntries={['/']}>
            <TreeNavigation {...mockProps} />
        </MemoryRouter>);

        // Open the parent namespace 'a'
        fireEvent.click(await screen.findByText('a'));

        // Its sub-namespaces are now visible
        await screen.findByText('a.b');
        expect(screen.getByText('a.c')).toBeInTheDocument();

        // Open then collapse the child sub-namespace 'a.b'
        fireEvent.click(screen.getByText('a.b'));
        fireEvent.click(screen.getByText('a.b'));

        // Collapsing the child must NOT collapse the parent — its other child is still shown
        expect(screen.getByText('a.c')).toBeInTheDocument();
    });

    it('collapses a deselected childless namespace instead of leaving an empty expander', async () => {
        vi.mocked(useParams).mockReturnValue({});
        mockCalmServiceWithNamespaces(['a', 'a.b', 'a.c']);

        render(<MemoryRouter initialEntries={['/']}>
            <TreeNavigation {...mockProps} />
        </MemoryRouter>);

        // Open parent 'a', then select the childless sub-namespace 'a.b'
        fireEvent.click(await screen.findByText('a'));
        fireEvent.click(await screen.findByText('a.b'));
        expect(screen.getByText('a.b').closest('details')).toHaveAttribute('open');

        // Select sibling 'a.c' — 'a.b' is deselected and has no children, so it collapses
        fireEvent.click(screen.getByText('a.c'));
        expect(screen.getByText('a.b').closest('details')).not.toHaveAttribute('open');
        // Parent 'a' has children, so it stays open and both children remain visible
        expect(screen.getByText('a.c')).toBeInTheDocument();
    });

    it('clears the selected type and resource list when authStore emits a 403', async () => {
        vi.mocked(useParams).mockReturnValue({});

        render(<MemoryRouter initialEntries={['/']}>
            <TreeNavigation {...mockProps} />
        </MemoryRouter>);

        // Override to return a known architecture so we can assert its removal
        await screen.findByText('test-namespace');
        calmServiceInstance!.fetchArchitectureSummaries.mockResolvedValue([{ id: 1, name: 'arch-a', description: '' }]);

        fireEvent.click(screen.getByText('test-namespace'));
        fireEvent.click(await screen.findByText('Architectures'));
        await screen.findByText('arch-a');

        act(() => {
            authStore.setAuthError(403);
        });

        expect(screen.queryByText('arch-a')).not.toBeInTheDocument();
    });

    it('does not show stale summaries from the previous namespace while the new fetch is pending', async () => {
        vi.mocked(useParams).mockReturnValue({});

        render(<MemoryRouter initialEntries={['/']}>
            <TreeNavigation {...mockProps} />
        </MemoryRouter>);

        await screen.findByText('test-namespace');
        // First call (test-namespace) resolves; second call (another-namespace) never resolves
        calmServiceInstance!.fetchArchitectureSummaries
            .mockResolvedValueOnce([{ id: 1, name: 'arch-a', description: '' }])
            .mockReturnValueOnce(new Promise(() => {}));

        // Load arch-a under test-namespace
        fireEvent.click(screen.getByText('test-namespace'));
        fireEvent.click(await screen.findByText('Architectures'));
        await screen.findByText('arch-a');

        // Switch to another-namespace and open Architectures (fetch never resolves)
        fireEvent.click(screen.getByText('another-namespace'));
        fireEvent.click(await screen.findByText('Architectures'));

        // arch-a must be gone immediately — not shown while the new fetch is pending
        expect(screen.queryByText('arch-a')).not.toBeInTheDocument();
    });

    it('clears selected domain and controls when authStore emits a 403', async () => {
        vi.mocked(useParams).mockReturnValue({});

        render(<MemoryRouter initialEntries={['/']}>
            <TreeNavigation {...mockProps} />
        </MemoryRouter>);

        await screen.findByText('test-domain');
        controlServiceInstance!.fetchControlsForDomain.mockResolvedValue([{ id: 1, name: 'Alpha Control', description: '' }]);

        fireEvent.click(screen.getByText('test-domain'));
        await screen.findByText('Alpha Control');

        act(() => {
            authStore.setAuthError(403);
        });

        expect(screen.queryByText('Alpha Control')).not.toBeInTheDocument();
    });

    it('does not show stale controls from the previous domain while the new fetch is pending', async () => {
        vi.mocked(useParams).mockReturnValue({});
        vi.mocked(ControlService).mockImplementationOnce(function () {
            controlServiceInstance = {
                fetchDomains: vi.fn().mockResolvedValue(['domain-a', 'domain-b']),
                fetchControlsForDomain: vi.fn()
                    .mockResolvedValueOnce([{ id: 1, name: 'Alpha Control', description: '' }])
                    .mockReturnValueOnce(new Promise(() => {})),
            };
            return controlServiceInstance as unknown as InstanceType<typeof ControlService>;
        });

        render(<MemoryRouter initialEntries={['/']}>
            <TreeNavigation {...mockProps} />
        </MemoryRouter>);

        // Load Alpha Control under domain-a
        fireEvent.click(await screen.findByText('domain-a'));
        await screen.findByText('Alpha Control');

        // Switch to domain-b (fetch never resolves)
        fireEvent.click(screen.getByText('domain-b'));

        // Alpha Control must be gone immediately — not shown while the new fetch is pending
        expect(screen.queryByText('Alpha Control')).not.toBeInTheDocument();
    });

    it('does not show stale ADR summaries from the previous namespace while the new fetch is pending', async () => {
        vi.mocked(useParams).mockReturnValue({});

        render(<MemoryRouter initialEntries={['/']}>
            <TreeNavigation {...mockProps} />
        </MemoryRouter>);

        await screen.findByText('test-namespace');
        adrServiceInstance!.fetchAdrSummaries
            .mockResolvedValueOnce([{ id: 201, title: 'Use CALM', status: 'accepted' }])
            .mockReturnValueOnce(new Promise(() => {}));

        // Load ADR summaries under test-namespace
        fireEvent.click(screen.getByText('test-namespace'));
        fireEvent.click(await screen.findByText('ADRs'));
        await screen.findByText('Use CALM (accepted)');

        // Switch to another-namespace and open ADRs (fetch never resolves)
        fireEvent.click(screen.getByText('another-namespace'));
        fireEvent.click(await screen.findByText('ADRs'));

        // Use CALM (accepted) must be gone immediately — not shown while the new fetch is pending
        expect(screen.queryByText('Use CALM (accepted)')).not.toBeInTheDocument();
    });

    it('discards a stale architecture response that resolves after a newer request has started', async () => {
        vi.mocked(useParams).mockReturnValue({});

        let resolveStale!: (value: unknown[]) => void;
        const stalePromise = new Promise<unknown[]>((resolve) => { resolveStale = resolve; });

        calmServiceInstance!.fetchArchitectureSummaries
            .mockReturnValueOnce(stalePromise)
            .mockReturnValueOnce(new Promise(() => {}));

        render(<MemoryRouter initialEntries={['/']}>
            <TreeNavigation {...mockProps} />
        </MemoryRouter>);

        await screen.findByText('test-namespace');

        // Start first request (stale, deferred)
        fireEvent.click(screen.getByText('test-namespace'));
        fireEvent.click(await screen.findByText('Architectures'));

        // Start second request (in-flight, never resolves)
        fireEvent.click(screen.getByText('another-namespace'));
        fireEvent.click(await screen.findByText('Architectures'));

        // Stale first request resolves late with data
        act(() => { resolveStale([{ id: 1, name: 'stale-arch', description: '' }]); });
        await new Promise((r) => setTimeout(r, 0));

        expect(screen.queryByText('stale-arch')).not.toBeInTheDocument();
    });

    it('discards a stale ADR response that resolves after a newer request has started', async () => {
        vi.mocked(useParams).mockReturnValue({});

        let resolveStale!: (value: unknown[]) => void;
        const stalePromise = new Promise<unknown[]>((resolve) => { resolveStale = resolve; });

        adrServiceInstance!.fetchAdrSummaries
            .mockReturnValueOnce(stalePromise)
            .mockReturnValueOnce(new Promise(() => {}));

        render(<MemoryRouter initialEntries={['/']}>
            <TreeNavigation {...mockProps} />
        </MemoryRouter>);

        await screen.findByText('test-namespace');

        // Start first request (stale, deferred)
        fireEvent.click(screen.getByText('test-namespace'));
        fireEvent.click(await screen.findByText('ADRs'));

        // Start second request (in-flight, never resolves)
        fireEvent.click(screen.getByText('another-namespace'));
        fireEvent.click(await screen.findByText('ADRs'));

        // Stale first request resolves late with data
        act(() => { resolveStale([{ id: 201, title: 'Stale ADR', status: 'accepted' }]); });
        await new Promise((r) => setTimeout(r, 0));

        expect(screen.queryByText('Stale ADR (accepted)')).not.toBeInTheDocument();
    });

    it('discards a stale interfaces response that resolves after a newer request has started', async () => {
        vi.mocked(useParams).mockReturnValue({});

        let resolveStale!: (value: unknown[]) => void;
        const stalePromise = new Promise<unknown[]>((resolve) => { resolveStale = resolve; });

        interfaceServiceInstance!.fetchInterfacesForNamespace
            .mockReturnValueOnce(stalePromise)
            .mockReturnValueOnce(new Promise(() => {}));

        render(<MemoryRouter initialEntries={['/']}>
            <TreeNavigation {...mockProps} />
        </MemoryRouter>);

        await screen.findByText('test-namespace');

        // Start first request (stale, deferred)
        fireEvent.click(screen.getByText('test-namespace'));
        fireEvent.click(await screen.findByText('Interfaces'));

        // Start second request (in-flight, never resolves)
        fireEvent.click(screen.getByText('another-namespace'));
        fireEvent.click(await screen.findByText('Interfaces'));

        // Stale first request resolves late with data
        act(() => { resolveStale([{ id: 1, name: 'Stale Interface', description: '' }]); });
        await new Promise((r) => setTimeout(r, 0));

        expect(screen.queryByText('Stale Interface')).not.toBeInTheDocument();
    });

    it('shows an empty list and does not throw when fetchArchitectureSummaries rejects', async () => {
        vi.mocked(useParams).mockReturnValue({});
        calmServiceInstance!.fetchArchitectureSummaries.mockRejectedValueOnce(new Error('403'));

        render(<MemoryRouter initialEntries={['/']}>
            <TreeNavigation {...mockProps} />
        </MemoryRouter>);

        await screen.findByText('test-namespace');
        fireEvent.click(screen.getByText('test-namespace'));
        fireEvent.click(await screen.findByText('Architectures'));

        // Wait for the rejected promise to settle
        await new Promise((r) => setTimeout(r, 0));

        expect(screen.queryByText('arch-a')).not.toBeInTheDocument();
    });

    it('shows an empty list and does not throw when fetchControlsForDomain rejects', async () => {
        vi.mocked(useParams).mockReturnValue({});
        controlServiceInstance!.fetchControlsForDomain.mockRejectedValueOnce(new Error('403'));

        render(<MemoryRouter initialEntries={['/']}>
            <TreeNavigation {...mockProps} />
        </MemoryRouter>);

        await screen.findByText('test-domain');
        fireEvent.click(screen.getByText('test-domain'));

        // Wait for the rejected promise to settle
        await new Promise((r) => setTimeout(r, 0));

        expect(screen.queryByText('Alpha Control')).not.toBeInTheDocument();
    });
});

describe('buildNamespaceTree', () => {
    it('returns flat list for namespaces without dots', () => {
        const tree = buildNamespaceTree(['alpha', 'beta']);
        expect(tree).toHaveLength(2);
        expect(tree[0]).toEqual({ label: 'alpha', namespace: 'alpha', children: [] });
        expect(tree[1]).toEqual({ label: 'beta', namespace: 'beta', children: [] });
    });

    it('collapses single-child non-namespace intermediate nodes', () => {
        // 'org' is not itself a namespace and has only one child → collapsed
        const tree = buildNamespaceTree(['org.finos', 'org.finos.calm', 'com.traderx']);
        expect(tree).toHaveLength(2);

        const orgFinos = tree.find((n) => n.label === 'org.finos');
        expect(orgFinos).toBeDefined();
        expect(orgFinos!.namespace).toBe('org.finos');
        expect(orgFinos!.children).toHaveLength(1);
        expect(orgFinos!.children[0]).toEqual({ label: 'org.finos.calm', namespace: 'org.finos.calm', children: [] });

        const comTraderx = tree.find((n) => n.label === 'com.traderx');
        expect(comTraderx).toBeDefined();
        expect(comTraderx!.namespace).toBe('com.traderx');
        expect(comTraderx!.children).toHaveLength(0);
    });

    it('does not collapse a namespace node even when it has a single child', () => {
        // 'org.finos' is itself a namespace — should appear even though it has one child
        const tree = buildNamespaceTree(['org.finos', 'org.finos.calm']);
        expect(tree).toHaveLength(1);
        expect(tree[0].label).toBe('org.finos');
        expect(tree[0].namespace).toBe('org.finos');
        expect(tree[0].children).toHaveLength(1);
        expect(tree[0].children[0].label).toBe('org.finos.calm');
    });

    it('keeps a non-namespace intermediate with multiple children as a grouping node', () => {
        // 'org.finos' is not a namespace but has two children
        const tree = buildNamespaceTree(['org.finos.calm', 'org.finos.wave']);
        expect(tree).toHaveLength(1);
        expect(tree[0].label).toBe('org.finos');
        expect(tree[0].namespace).toBeNull();
        expect(tree[0].children).toHaveLength(2);
    });

    it('handles an empty namespace list', () => {
        expect(buildNamespaceTree([])).toEqual([]);
    });

    it('renders hierarchical namespaces in the tree', async () => {
        vi.mocked(useParams).mockReturnValue({});
        vi.mocked(CalmService).mockImplementationOnce(function () { return {
            fetchNamespaces: vi.fn().mockResolvedValue(['org.finos', 'org.finos.calm', 'com.traderx']),
            fetchPatternSummaries: vi.fn().mockResolvedValue([]),
            fetchFlowSummaries: vi.fn().mockResolvedValue([]),
            fetchStandardSummaries: vi.fn().mockResolvedValue([]),
            fetchArchitectureSummaries: vi.fn().mockResolvedValue([]),
            fetchPatternVersions: vi.fn().mockResolvedValue([]),
            fetchFlowVersions: vi.fn().mockResolvedValue([]),
            fetchStandardVersions: vi.fn().mockResolvedValue([]),
            fetchArchitectureVersions: vi.fn().mockResolvedValue([]),
            fetchPattern: vi.fn().mockResolvedValue({}),
            fetchFlow: vi.fn().mockResolvedValue({}),
            fetchStandard: vi.fn().mockResolvedValue({}),
            fetchArchitecture: vi.fn().mockResolvedValue({}),
            fetchMappings: vi.fn().mockResolvedValue([]),
            fetchVersionsByCustomId: vi.fn().mockResolvedValue([]),
            fetchResourceByCustomId: vi.fn().mockResolvedValue({})
        }; });

        render(
            <MemoryRouter initialEntries={['/']}>
                <TreeNavigation onDataLoad={vi.fn()} onAdrLoad={vi.fn()} onControlLoad={vi.fn()} onInterfaceLoad={vi.fn()} />
            </MemoryRouter>
        );

        // The actual namespace labels should be present
        const orgFinosElements = await screen.findAllByText('org.finos');
        expect(orgFinosElements).toHaveLength(1);
        expect(screen.getByText('com.traderx')).toBeInTheDocument();
    });
});
