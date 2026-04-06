import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Drawer } from './Drawer.js';
import { Data } from '../../../model/calm.js';
import type { ReactFlowVisualizerProps } from '../../contracts/contracts.js';
import { DropzoneOptions } from 'react-dropzone';

const mockFetchDecoratorValues = vi.fn().mockResolvedValue([]);

vi.mock('../../../service/calm-service.js', () => ({
    CalmService: vi.fn().mockImplementation(() => ({
        fetchDecoratorValues: (...args: unknown[]) => mockFetchDecoratorValues(...args),
    })),
}));

vi.mock('../reactflow/MetadataPanel.js', () => ({
    MetadataPanel: ({ decorators }: { decorators: unknown[] }) => (
        <div data-testid="metadata-panel">decorators:{decorators.length}</div>
    ),
}));

// Mock dependencies
vi.mock('../reactflow/ReactFlowVisualizer.js', () => ({
    ReactFlowVisualizer: ({ calmData }: ReactFlowVisualizerProps) => (
        <div data-testid="reactflow-visualizer">
            <div data-testid="node-count">{calmData?.nodes?.length ?? 0}</div>
            <div data-testid="relationship-count">{calmData?.relationships?.length ?? 0}</div>
        </div>
    ),
}));
vi.mock('react-dropzone', async () => {
    const actual = await vi.importActual('react-dropzone');
    return {
        ...actual,
        useDropzone: ({ onDrop }: DropzoneOptions) => ({
            getRootProps: () => ({}),
            getInputProps: () => ({}),
            isDragActive: false,
            onDrop,
        }),
    };
});

const architectureData: Data = {
    name: 'my-namespace',
    calmType: 'Architectures',
    id: 'my-arch',
    version: '1.0.0',
    data: { nodes: [], relationships: [] },
};

const patternData: Data = {
    name: 'my-namespace',
    calmType: 'Patterns',
    id: 'my-pattern',
    version: '1.0.0',
    data: {
        properties: {
            nodes: { prefixItems: [] },
        },
    },
};

const calmData = {
    name: 'Test CALM',
    calmType: 'arch',
    id: '123',
    version: '1.0',
    data: {
        nodes: [
            {
                'unique-id': 'n1',
                name: 'Node 1',
                description: 'desc1',
                'node-type': 'typeA',
            },
            {
                'unique-id': 'n2',
                name: 'Node 2',
                description: 'desc2',
                'node-type': 'typeB',
            },
        ],
        relationships: [
            {
                'unique-id': 'r1',
                description: 'rel1',
                'relationship-type': {
                    interacts: {
                        actor: 'n1',
                        nodes: ['n2'],
                    },
                },
            },
            {
                'unique-id': 'r2',
                description: 'rel2',
                'relationship-type': {
                    'composed-of': {
                        container: 'n1',
                        nodes: ['n2'],
                    },
                },
            },
        ],
    },
};

describe('Drawer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders dropzone placeholder when no data is provided', () => {
        render(<Drawer />);
        expect(screen.getByText(/Drag and drop your file here or/i)).toBeInTheDocument();
        expect(screen.getByText(/Browse/i)).toBeInTheDocument();
    });

    it('renders ReactFlowVisualizer when data is provided', () => {
        render(<Drawer data={calmData as unknown as Data} />);
        expect(screen.getByTestId('reactflow-visualizer')).toBeInTheDocument();
        expect(screen.getByTestId('node-count')).toHaveTextContent('2');
        expect(screen.getByTestId('relationship-count')).toHaveTextContent('2');
    });

    it('does not show sidebar initially', () => {
        render(<Drawer data={calmData as unknown as Data} />);
        expect(screen.queryByLabelText('close-sidebar')).not.toBeInTheDocument();
    });
});

describe('Drawer — decorator fetching', () => {
    beforeEach(() => {
        mockFetchDecoratorValues.mockReset();
        mockFetchDecoratorValues.mockResolvedValue([]);
    });

    it('fetches decorator values using friendly URL when architecture data has a slug ID', async () => {
        render(<Drawer data={architectureData} />);

        await waitFor(() => {
            expect(mockFetchDecoratorValues).toHaveBeenCalledWith(
                'my-namespace',
                '/calm/my-namespace/my-arch/versions/1-0-0',
                'deployment'
            );
        });
    });

    it('fetches decorator values using numeric URL when architecture data has a numeric ID', async () => {
        const numericArchData: Data = {
            name: 'my-namespace',
            calmType: 'Architectures',
            id: '42',
            version: '1.0.0',
            data: { nodes: [], relationships: [] },
        };
        render(<Drawer data={numericArchData} />);

        await waitFor(() => {
            expect(mockFetchDecoratorValues).toHaveBeenCalledWith(
                'my-namespace',
                '/calm/namespaces/my-namespace/architectures/42/versions/1-0-0',
                'deployment'
            );
        });
    });

    it('does not fetch decorator values when decorators prop is provided', async () => {
        render(<Drawer data={architectureData} decorators={[]} />);

        await waitFor(() => {
            expect(mockFetchDecoratorValues).not.toHaveBeenCalled();
        });
    });

    it('does not fetch decorator values for pattern data', async () => {
        render(<Drawer data={patternData} />);

        await waitFor(() => {
            expect(mockFetchDecoratorValues).not.toHaveBeenCalled();
        });
    });

    it('passes fetched decorators to MetadataPanel', async () => {
        const decorators = [{
            schema: 'https://calm.finos.org/draft/2026-03/standards/deployment/deployment.decorator.standard.json',
            uniqueId: 'dec-1',
            type: 'deployment',
            target: ['/calm/namespaces/my-namespace/architectures/my-arch/versions/1-0-0'],
            appliesTo: ['node-a'],
            data: {
                status: 'completed',
                'start-time': '2024-01-01T10:00:00Z',
                'end-time': '2024-01-01T10:05:00Z',
            },
        }];
        mockFetchDecoratorValues.mockResolvedValue(decorators);

        render(<Drawer data={architectureData} />);

        await waitFor(() => {
            expect(screen.getByTestId('metadata-panel')).toHaveTextContent('decorators:1');
        });
    });

    it('passes externally provided decorators to MetadataPanel without fetching', async () => {
        const decorators = [{
            schema: 'https://calm.finos.org/draft/2026-03/standards/deployment/deployment.decorator.standard.json',
            uniqueId: 'dec-ext',
            type: 'deployment',
            target: ['/calm/namespaces/my-namespace/architectures/my-arch/versions/1-0-0'],
            appliesTo: ['node-a'],
            data: {
                status: 'failed',
                'start-time': '2024-01-01T10:00:00Z',
                'end-time': '2024-01-01T10:05:00Z',
            },
        }];

        render(<Drawer data={architectureData} decorators={decorators} />);

        await waitFor(() => {
            expect(screen.getByTestId('metadata-panel')).toHaveTextContent('decorators:1');
        });
        expect(mockFetchDecoratorValues).not.toHaveBeenCalled();
    });
});
