import { render, screen } from '@testing-library/react';
import { TreeNavigation } from './TreeNavigation.js';
import { MemoryRouter, useParams } from 'react-router-dom';
import { fetchArchitectureIDs, fetchArchitectureVersions, fetchFlow, fetchFlowIDs, fetchFlowVersions, fetchNamespaces, fetchPatternIDs } from '../../../service/calm-service.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('../../../service/adr-service/adr-service.js', () => ({
    AdrService: vi.fn().mockImplementation(() => ({
        fetchAdrIDs: vi.fn().mockResolvedValue([]),
        fetchAdrRevisions: vi.fn().mockResolvedValue([]),
        fetchAdr: vi.fn().mockResolvedValue({})
    }))
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

    it('loads data based on deeplink route - type', () => {
        vi.mocked(useParams).mockReturnValue({
            namespace: 'test-namespace',
            type: 'Patterns',
        });

        // Mock fetchPatternIDs to return some data for UI checks
        vi.mocked(fetchPatternIDs).mockImplementation((ns, callback) => Promise.resolve(callback(['pattern1', 'pattern2'])));

        render(<MemoryRouter initialEntries={["/"]}>
            <TreeNavigation {...mockProps} />
        </MemoryRouter>);

        expect(fetchNamespaces).toHaveBeenCalledWith(expect.any(Function));
        expect(fetchPatternIDs).toHaveBeenCalledWith('test-namespace', expect.any(Function));

        // Resource IDs for selected type should be visible
        expect(screen.getByText('pattern1')).toBeInTheDocument();
        expect(screen.getByText('pattern2')).toBeInTheDocument();
    });

    it('loads data based on deeplink route - resource ID', () => {
        vi.mocked(useParams).mockReturnValue({
            namespace: 'test-namespace',
            type: 'Architectures',
            id: '201',
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

        // Architecture IDs should be visible
        expect(screen.getByText('201')).toBeInTheDocument();
        expect(screen.getByText('202')).toBeInTheDocument();

        // Versions should be visible
        expect(screen.getByText('v1.0')).toBeInTheDocument();
        expect(screen.getByText('v2.0')).toBeInTheDocument();
    });

    it('loads data based on deeplink route - version', () => {
        vi.mocked(useParams).mockReturnValue({
            namespace: 'test-namespace',
            type: 'Flows',
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
});