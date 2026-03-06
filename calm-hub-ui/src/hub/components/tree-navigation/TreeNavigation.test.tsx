import { render, screen } from '@testing-library/react';
import { TreeNavigation } from './TreeNavigation.js';

// Mock the service class
vi.mock('../../../service/calm-service.js', () => ({
    CalmService: vi.fn().mockImplementation(() => ({
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
    }))
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

    it('renders the tree navigation component', async () => {
        render(<TreeNavigation {...mockProps} />);

        expect(screen.getByText('Namespaces')).toBeInTheDocument();
        expect(await screen.findByText('test-namespace')).toBeInTheDocument();
        expect(screen.getByText('another-namespace')).toBeInTheDocument();
    });

    it('shows resource types only when namespace is selected', async () => {
        render(<TreeNavigation {...mockProps} />);

        // Wait for namespaces to load
        await screen.findByText('test-namespace');

        // Resource types should not be visible since no namespace is selected
        expect(screen.queryByText('Architectures')).not.toBeInTheDocument();
        expect(screen.queryByText('Patterns')).not.toBeInTheDocument();
        expect(screen.queryByText('Flows')).not.toBeInTheDocument();
        expect(screen.queryByText('ADRs')).not.toBeInTheDocument();
    });

    it('handles initial state correctly', async () => {
        render(<TreeNavigation {...mockProps} />);

        expect(screen.getByText('Namespaces')).toBeInTheDocument();
        expect(await screen.findByText('test-namespace')).toBeInTheDocument();
        expect(screen.getByText('another-namespace')).toBeInTheDocument();
    });
});