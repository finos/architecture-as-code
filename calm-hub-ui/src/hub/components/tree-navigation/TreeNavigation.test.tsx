import { render, screen } from '@testing-library/react';
import { TreeNavigation } from './TreeNavigation.js';
import { MemoryRouter, useParams } from 'react-router-dom';
import { fetchArchitectureIDs, fetchArchitectureVersions, fetchFlow, fetchFlowIDs, fetchFlowVersions, fetchNamespaces, fetchPatternIDs } from '../../../service/calm-service.js';

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useParams: vi.fn().mockReturnValue({}),
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

        render(<MemoryRouter initialEntries={["/"]}>
            <TreeNavigation {...mockProps} />
        </MemoryRouter>);

        expect(fetchNamespaces).toHaveBeenCalledWith(expect.any(Function));
        expect(fetchPatternIDs).toHaveBeenCalledWith('test-namespace', expect.any(Function));
    });

    it('loads data based on deeplink route - resource ID', () => {
        vi.mocked(useParams).mockReturnValue({
            namespace: 'test-namespace',
            type: 'Architectures',
            id: '201',
        });

        render(<MemoryRouter initialEntries={["/"]}>
            <TreeNavigation {...mockProps} />
        </MemoryRouter>);

        expect(fetchNamespaces).toHaveBeenCalledWith(expect.any(Function));
        expect(fetchArchitectureIDs).toHaveBeenCalledWith('test-namespace', expect.any(Function));
        expect(fetchArchitectureVersions).toHaveBeenCalledWith('test-namespace', '201', expect.any(Function));
    });

    it('loads data based on deeplink route - version', () => {
        vi.mocked(useParams).mockReturnValue({
            namespace: 'test-namespace',
            type: 'Flows',
            id: '201',
            version: 'v2.0'
        });

        render(<MemoryRouter initialEntries={["/"]}>
            <TreeNavigation {...mockProps} />
        </MemoryRouter>);

        expect(fetchNamespaces).toHaveBeenCalledWith(expect.any(Function));
        expect(fetchFlowIDs).toHaveBeenCalledWith('test-namespace', expect.any(Function));
        expect(fetchFlowVersions).toHaveBeenCalledWith('test-namespace', '201', expect.any(Function));
        expect(fetchFlow).toHaveBeenCalledWith('test-namespace', '201', 'v2.0', expect.any(Function))
    });
});