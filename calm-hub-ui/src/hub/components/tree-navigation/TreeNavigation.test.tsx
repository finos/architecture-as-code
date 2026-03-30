import { render, screen, waitFor } from '@testing-library/react';
import { TreeNavigation, buildNamespaceTree } from './TreeNavigation.js';
import { CalmService } from '../../../service/calm-service.js';
import { MemoryRouter, useParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi, Mock } from 'vitest';

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
    fetchPatternIDs: Mock;
    fetchFlowIDs: Mock;
    fetchArchitectureIDs: Mock;
    fetchPatternVersions: Mock;
    fetchFlowVersions: Mock;
    fetchArchitectureVersions: Mock;
    fetchPattern: Mock;
    fetchFlow: Mock;
    fetchArchitecture: Mock;
} | undefined;

vi.mock('../../../service/calm-service.js', () => ({
    CalmService: vi.fn().mockImplementation(() => {
        calmServiceInstance = {
            fetchNamespaces: vi.fn().mockResolvedValue(['test-namespace', 'another-namespace']),
            fetchPatternIDs: vi.fn().mockResolvedValue([]),
            fetchFlowIDs: vi.fn().mockResolvedValue([]),
            fetchArchitectureIDs: vi.fn().mockResolvedValue([]),
            fetchPatternVersions: vi.fn().mockResolvedValue([]),
            fetchFlowVersions: vi.fn().mockResolvedValue([]),
            fetchArchitectureVersions: vi.fn().mockResolvedValue([]),
            fetchPattern: vi.fn().mockResolvedValue({}),
            fetchFlow: vi.fn().mockResolvedValue({}),
            fetchArchitecture: vi.fn().mockResolvedValue({})
        };
        return calmServiceInstance;
    })
}));

vi.mock('../../../service/control-service.js', () => ({
    fetchDomains: vi.fn((callback) => callback(['test-domain'])),
    fetchControlsForDomain: vi.fn(),
}));

let adrServiceInstance: {
    fetchAdrIDs: Mock;
    fetchAdrRevisions: Mock;
    fetchAdr: Mock;
} | undefined;
vi.mock('../../../service/adr-service/adr-service.js', () => ({
    AdrService: vi.fn().mockImplementation(() => {
        adrServiceInstance = {
            fetchAdrIDs: vi.fn().mockResolvedValue(['201', '202']),
            fetchAdrRevisions: vi.fn().mockResolvedValue(['v1.0', 'v2.0']),
            fetchAdr: vi.fn().mockResolvedValue({})
        };
        return adrServiceInstance;
    })
}));

const mockProps = {
    onDataLoad: vi.fn(),
    onAdrLoad: vi.fn(),
    onControlLoad: vi.fn()
};

describe('TreeNavigation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the tree navigation component', async () => {
        render(<MemoryRouter initialEntries={["/"]}>
            <TreeNavigation {...mockProps} />
        </MemoryRouter>);

        expect(screen.getByText('Namespaces')).toBeInTheDocument();
        expect(screen.getByText('Control Domains')).toBeInTheDocument();
        expect(await screen.findByText('test-namespace')).toBeInTheDocument();
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
        expect(await screen.findByText('test-namespace')).toBeInTheDocument();
        expect(screen.getByText('another-namespace')).toBeInTheDocument();
    });

    it('loads data based on deeplink route - pattern', async () => {
        vi.mocked(useParams).mockReturnValue({
            namespace: 'test-namespace',
            type: 'patterns',
            id: 'pattern2',
            version: 'v2.0'
        });

        render(<MemoryRouter initialEntries={["/"]}>
            <TreeNavigation {...mockProps} />
        </MemoryRouter>);

        await waitFor(() => {
            expect(calmServiceInstance?.fetchNamespaces).toHaveBeenCalled();
            expect(calmServiceInstance?.fetchPatternIDs).toHaveBeenCalledWith('test-namespace');
            expect(calmServiceInstance?.fetchPatternVersions).toHaveBeenCalledWith('test-namespace', 'pattern2');
            expect(calmServiceInstance?.fetchPattern).toHaveBeenCalledWith('test-namespace', 'pattern2', 'v2.0');
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
            expect(calmServiceInstance?.fetchArchitectureIDs).toHaveBeenCalledWith('test-namespace');
            expect(calmServiceInstance?.fetchArchitectureVersions).toHaveBeenCalledWith('test-namespace', '201');
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
            expect(calmServiceInstance?.fetchFlowIDs).toHaveBeenCalledWith('test-namespace');
            expect(calmServiceInstance?.fetchFlowVersions).toHaveBeenCalledWith('test-namespace', '201');
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
            expect(adrServiceInstance?.fetchAdrIDs).toHaveBeenCalledWith('test-namespace');
            expect(adrServiceInstance?.fetchAdrRevisions).toHaveBeenCalledWith('test-namespace', '201');
            expect(adrServiceInstance?.fetchAdr).toHaveBeenCalledWith('test-namespace', '201', 'v2.0');
        });
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
        vi.mocked(CalmService).mockImplementationOnce(() => ({
            fetchNamespaces: vi.fn().mockResolvedValue(['org.finos', 'org.finos.calm', 'com.traderx']),
            fetchPatternIDs: vi.fn().mockResolvedValue([]),
            fetchFlowIDs: vi.fn().mockResolvedValue([]),
            fetchArchitectureIDs: vi.fn().mockResolvedValue([]),
            fetchPatternVersions: vi.fn().mockResolvedValue([]),
            fetchFlowVersions: vi.fn().mockResolvedValue([]),
            fetchArchitectureVersions: vi.fn().mockResolvedValue([]),
            fetchPattern: vi.fn().mockResolvedValue({}),
            fetchFlow: vi.fn().mockResolvedValue({}),
            fetchArchitecture: vi.fn().mockResolvedValue({})
        }));

        render(
            <MemoryRouter initialEntries={['/']}>
                <TreeNavigation onDataLoad={vi.fn()} onAdrLoad={vi.fn()} />
            </MemoryRouter>
        );

        // Collapsed intermediates: 'org' and 'com' should not appear as standalone entries
        expect(screen.queryByText('org')).not.toBeInTheDocument();
        expect(screen.queryByText('com')).not.toBeInTheDocument();

        // The actual namespace labels should be present
        expect(await screen.findByText('org.finos')).toBeInTheDocument();
        expect(screen.getByText('com.traderx')).toBeInTheDocument();

        // Child namespace 'org.finos.calm' is nested — not visible until parent is expanded
        expect(screen.queryByText('org.finos.calm')).not.toBeInTheDocument();
    });
});
