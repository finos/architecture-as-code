import { render, screen, waitFor } from '@testing-library/react';
import { TreeNavigation } from './TreeNavigation.js';
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

    it('renders the tree navigation component', async () => {
        render(<MemoryRouter initialEntries={["/"]}>
            <TreeNavigation {...mockProps} />
        </MemoryRouter>);
        
        expect(screen.getByText('Namespaces')).toBeInTheDocument();
        expect(await screen.findByText('test-namespace')).toBeInTheDocument();
        expect(screen.getByText('another-namespace')).toBeInTheDocument();
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

});