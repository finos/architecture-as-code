import { render, screen } from '@testing-library/react';
import { TreeNavigation } from './TreeNavigation.js';

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
        render(<TreeNavigation {...mockProps} />);
        
        expect(screen.getByText('Namespaces')).toBeInTheDocument();
        expect(screen.getByText('test-namespace')).toBeInTheDocument();
        expect(screen.getByText('another-namespace')).toBeInTheDocument();
    });

    it('shows resource types only when namespace is selected', () => {
        render(<TreeNavigation {...mockProps} />);
        
        // Initially, resource types should not be visible since no namespace is selected
        expect(screen.queryByText('Architectures')).not.toBeInTheDocument();
        expect(screen.queryByText('Patterns')).not.toBeInTheDocument();
        expect(screen.queryByText('Flows')).not.toBeInTheDocument();
        expect(screen.queryByText('ADRs')).not.toBeInTheDocument();
    });

    it('handles initial state correctly', () => {
        render(<TreeNavigation {...mockProps} />);
        
        expect(screen.getByText('Namespaces')).toBeInTheDocument();
        expect(screen.getByText('test-namespace')).toBeInTheDocument();
        expect(screen.getByText('another-namespace')).toBeInTheDocument();
    });
});