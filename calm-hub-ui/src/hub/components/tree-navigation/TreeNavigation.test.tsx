import { render, screen, waitFor } from '@testing-library/react';
import { TreeNavigation, buildNamespaceTree } from './TreeNavigation.js';
import { MemoryRouter, useParams } from 'react-router-dom';
import { fetchArchitecture, fetchArchitectureIDs, fetchArchitectureVersions, fetchFlow, fetchFlowIDs, fetchFlowVersions, fetchNamespaces, fetchPattern, fetchPatternIDs, fetchPatternVersions } from '../../../service/calm-service.js';
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

// Mock the service functions
vi.mock('../../../service/calm-service.js', () => ({
    fetchNamespaces: vi.fn((callback) => callback(['test-namespace', 'another-namespace'])),
    fetchPatternIDs: vi.fn(),
    fetchFlowIDs: vi.fn(),
    fetchArchitectureIDs: vi.fn(),
    fetchPatternVersions: vi.fn(),
    fetchFlowVersions: vi.fn(),
    fetchArchitectureVersions: vi.fn(),
    fetchPattern: vi.fn(),
    fetchFlow: vi.fn(),
    fetchArchitecture: vi.fn()
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
    onAdrLoad: vi.fn()
};

describe('TreeNavigation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the tree navigation component', () => {
        render(<MemoryRouter initialEntries={["/"]}>
            <TreeNavigation {...mockProps} />
        </MemoryRouter>);
        
        expect(screen.getByText('Namespaces')).toBeInTheDocument();
        expect(screen.getByText('test-namespace')).toBeInTheDocument();
        expect(screen.getByText('another-namespace')).toBeInTheDocument();
    });

    it('shows resource types only when namespace is selected', () => {
        render(<MemoryRouter initialEntries={["/"]}>
            <TreeNavigation {...mockProps} />
        </MemoryRouter>);
        
        // Initially, resource types should not be visible since no namespace is selected
        expect(screen.queryByText('Architectures')).not.toBeInTheDocument();
        expect(screen.queryByText('Patterns')).not.toBeInTheDocument();
        expect(screen.queryByText('Flows')).not.toBeInTheDocument();
        expect(screen.queryByText('ADRs')).not.toBeInTheDocument();
    });

    it('handles initial state correctly', () => {
        render(<MemoryRouter initialEntries={["/"]}>
            <TreeNavigation {...mockProps} />
        </MemoryRouter>);
        
        expect(screen.getByText('Namespaces')).toBeInTheDocument();
        expect(screen.getByText('test-namespace')).toBeInTheDocument();
        expect(screen.getByText('another-namespace')).toBeInTheDocument();
    });

    it('loads data based on deeplink route - pattern', () => {
        vi.mocked(useParams).mockReturnValue({
            namespace: 'test-namespace',
            type: 'patterns',
            id: 'pattern2',
            version: 'v2.0'
        });

        // Mock fetchPatternIDs and fetchPatternVersions to return data
        vi.mocked(fetchPatternIDs).mockImplementation((ns, callback) => Promise.resolve(callback(['pattern1', 'pattern2'])));
        vi.mocked(fetchPatternVersions).mockImplementation((ns, id, callback) => Promise.resolve(callback(['v1.0', 'v2.0'])));

        render(<MemoryRouter initialEntries={["/"]}>
            <TreeNavigation {...mockProps} />
        </MemoryRouter>);

        expect(fetchNamespaces).toHaveBeenCalledWith(expect.any(Function));
        expect(fetchPatternIDs).toHaveBeenCalledWith('test-namespace', expect.any(Function));
        expect(fetchPatternVersions).toHaveBeenCalledWith('test-namespace', 'pattern2', expect.any(Function));
        expect(fetchPattern).toHaveBeenCalledWith('test-namespace', 'pattern2', 'v2.0', expect.any(Function));

        // Architecture IDs should be visible
        expect(screen.getByText('pattern1')).toBeInTheDocument();
        expect(screen.getByText('pattern2')).toBeInTheDocument();

        // Versions should be visible
        expect(screen.getByText('v1.0')).toBeInTheDocument();
        expect(screen.getByText('v2.0')).toBeInTheDocument();
    });

    it('loads data based on deeplink route - architecture', () => {
        vi.mocked(useParams).mockReturnValue({
            namespace: 'test-namespace',
            type: 'architectures',
            id: '201',
            version: 'v2.0'
        });

        // Mock fetchArchitectureIDs and fetchArchitectureVersions to return data
        vi.mocked(fetchArchitectureIDs).mockImplementation((ns, callback) => Promise.resolve(callback(['201', '202'])));
        vi.mocked(fetchArchitectureVersions).mockImplementation((ns, id, callback) => Promise.resolve(callback(['v1.0', 'v2.0'])));

        render(<MemoryRouter initialEntries={["/"]}>
            <TreeNavigation {...mockProps} />
        </MemoryRouter>);

        expect(fetchNamespaces).toHaveBeenCalledWith(expect.any(Function));
        expect(fetchArchitectureIDs).toHaveBeenCalledWith('test-namespace', expect.any(Function));
        expect(fetchArchitectureVersions).toHaveBeenCalledWith('test-namespace', '201', expect.any(Function));
        expect(fetchArchitecture).toHaveBeenCalledWith('test-namespace', '201', 'v2.0', expect.any(Function));

        // Architecture IDs should be visible
        expect(screen.getByText('201')).toBeInTheDocument();
        expect(screen.getByText('202')).toBeInTheDocument();

        // Versions should be visible
        expect(screen.getByText('v1.0')).toBeInTheDocument();
        expect(screen.getByText('v2.0')).toBeInTheDocument();
    });

    it('loads data based on deeplink route - flow', () => {
        vi.mocked(useParams).mockReturnValue({
            namespace: 'test-namespace',
            type: 'flows',
            id: '201',
            version: 'v2.0'
        });

        // Mock fetchFlowIDs, fetchFlowVersions, and fetchFlow to return data
        vi.mocked(fetchFlowIDs).mockImplementation((ns, callback) => Promise.resolve(callback(['201', '202'])));
        vi.mocked(fetchFlowVersions).mockImplementation((ns, id, callback) => Promise.resolve(callback(['v1.0', 'v2.0'])));

        render(<MemoryRouter initialEntries={["/"]}>
            <TreeNavigation {...mockProps} />
        </MemoryRouter>);

        expect(fetchNamespaces).toHaveBeenCalledWith(expect.any(Function));
        expect(fetchFlowIDs).toHaveBeenCalledWith('test-namespace', expect.any(Function));
        expect(fetchFlowVersions).toHaveBeenCalledWith('test-namespace', '201', expect.any(Function));
        expect(fetchFlow).toHaveBeenCalledWith('test-namespace', '201', 'v2.0', expect.any(Function));

        // Flow IDs should be visible
        expect(screen.getByText('201')).toBeInTheDocument();
        expect(screen.getByText('202')).toBeInTheDocument();

        // Versions should be visible
        expect(screen.getByText('v1.0')).toBeInTheDocument();
        expect(screen.getByText('v2.0')).toBeInTheDocument();
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

        expect(fetchNamespaces).toHaveBeenCalledWith(expect.any(Function));
        
        // Use waitFor since AdrService methods return promises
        await waitFor(() => {
            expect(adrServiceInstance?.fetchAdrIDs).toHaveBeenCalledWith('test-namespace');
            expect(adrServiceInstance?.fetchAdrRevisions).toHaveBeenCalledWith('test-namespace', '201');
            expect(adrServiceInstance?.fetchAdr).toHaveBeenCalledWith('test-namespace', '201', 'v2.0');
        });

        // ADR IDs should be visible
        expect(screen.getByText('201')).toBeInTheDocument();
        expect(screen.getByText('202')).toBeInTheDocument();

        // Versions should be visible
        expect(screen.getByText('v1.0')).toBeInTheDocument();
        expect(screen.getByText('v2.0')).toBeInTheDocument();
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

    it('renders hierarchical namespaces in the tree', () => {
        vi.mocked(fetchNamespaces).mockImplementation((cb) => cb(['org.finos', 'org.finos.calm', 'com.traderx']));
        vi.mocked(useParams).mockReturnValue({});

        render(
            <MemoryRouter initialEntries={['/']}>
                <TreeNavigation onDataLoad={vi.fn()} onAdrLoad={vi.fn()} />
            </MemoryRouter>
        );

        // Collapsed intermediates: 'org' and 'com' should not appear as standalone entries
        expect(screen.queryByText('org')).not.toBeInTheDocument();
        expect(screen.queryByText('com')).not.toBeInTheDocument();

        // The actual namespace labels should be present
        expect(screen.getByText('org.finos')).toBeInTheDocument();
        expect(screen.getByText('com.traderx')).toBeInTheDocument();

        // Child namespace 'org.finos.calm' is nested — not visible until parent is expanded
        expect(screen.queryByText('org.finos.calm')).not.toBeInTheDocument();
    });
});