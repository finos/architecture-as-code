import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { Drawer } from './Drawer.js';
import { Data } from '../../../model/calm.js';
import type { ReactFlowVisualizerProps } from '../../contracts/contracts.js';
import type { PatternVisualizerProps } from '../reactflow/PatternVisualizer.js';
import { DropzoneOptions } from 'react-dropzone';

// Captures the `onDrop` the Drawer hands to react-dropzone so tests can invoke
// it directly with a fake File. Hoisted so the (hoisted) vi.mock factory below
// can reference it without hitting the temporal-dead-zone.
const { mockDropzone } = vi.hoisted(() => ({
    mockDropzone: {} as { onDrop?: (files: File[]) => void | Promise<void> },
}));

/** A minimal File stand-in whose `.text()` resolves to the given contents. */
function fakeFile(text: string): File {
    return { text: () => Promise.resolve(text) } as unknown as File;
}

const mockFetchDeploymentDecoratorsForArchitecture = vi.fn().mockResolvedValue([]);

vi.mock('../../../service/calm-service.js', () => ({
    CalmService: vi.fn().mockImplementation(function () { return {
        fetchDeploymentDecoratorsForArchitecture: (...args: unknown[]) => mockFetchDeploymentDecoratorsForArchitecture(...args),
    }; }),
}));

vi.mock('../reactflow/MetadataPanel.js', () => ({
    MetadataPanel: ({ decorators }: { decorators: unknown[] }) => (
        <div data-testid="metadata-panel">decorators:{decorators.length}</div>
    ),
}));

// Mock dependencies
vi.mock('../reactflow/ReactFlowVisualizer.js', () => ({
    ReactFlowVisualizer: ({ calmData, viewportKey, defaultLayout, layoutEpoch, onPositionsChange }: ReactFlowVisualizerProps) => (
        <div data-testid="reactflow-visualizer">
            <div data-testid="node-count">{calmData?.nodes?.length ?? 0}</div>
            <div data-testid="relationship-count">{calmData?.relationships?.length ?? 0}</div>
            <div data-testid="viewport-key">{viewportKey ?? '(none)'}</div>
            <div data-testid="architecture-default-layout">{defaultLayout === undefined ? '(undefined)' : JSON.stringify(defaultLayout)}</div>
            <div data-testid="architecture-layout-epoch">{layoutEpoch ?? '(none)'}</div>
            <button
                data-testid="architecture-report-positions"
                onClick={() => onPositionsChange?.([{ id: 'n1', position: { x: 1, y: 2 } }])}
            >
                report
            </button>
        </div>
    ),
}));
vi.mock('../reactflow/PatternVisualizer.js', () => ({
    PatternVisualizer: ({ viewportKey, defaultLayout, layoutEpoch, onPositionsChange }: PatternVisualizerProps) => (
        <div data-testid="pattern-visualizer">
            <div data-testid="viewport-key">{viewportKey ?? '(none)'}</div>
            <div data-testid="pattern-default-layout">{defaultLayout === undefined ? '(undefined)' : JSON.stringify(defaultLayout)}</div>
            <div data-testid="pattern-layout-epoch">{layoutEpoch ?? '(none)'}</div>
            <button
                data-testid="pattern-report-positions"
                onClick={() => onPositionsChange?.([{ id: 'n1', position: { x: 1, y: 2 } }])}
            >
                report
            </button>
        </div>
    ),
}));
vi.mock('react-dropzone', async () => {
    const actual = await vi.importActual('react-dropzone');
    return {
        ...actual,
        useDropzone: ({ onDrop }: DropzoneOptions) => {
            mockDropzone.onDrop = onDrop as (files: File[]) => void | Promise<void>;
            return {
                getRootProps: () => ({}),
                getInputProps: () => ({}),
                isDragActive: false,
                onDrop,
            };
        },
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

    it('renders the bordered dropzone empty state when no data is provided', () => {
        render(<Drawer />);
        expect(screen.getByTestId('dropzone-empty-state')).toBeInTheDocument();
        expect(screen.getByText(/Drag & drop or/i)).toBeInTheDocument();
        expect(screen.getByText(/Browse/i)).toBeInTheDocument();
        expect(screen.getByText(/Accepts CALM JSON/i)).toBeInTheDocument();
    });

    it('renders ReactFlowVisualizer when data is provided', () => {
        render(<Drawer data={calmData as unknown as Data} />);
        expect(screen.getByTestId('reactflow-visualizer')).toBeInTheDocument();
        expect(screen.getByTestId('node-count')).toHaveTextContent('2');
        expect(screen.getByTestId('relationship-count')).toHaveTextContent('2');
    });

    it('does not show sidebar initially', () => {
        render(<Drawer data={calmData as unknown as Data} />);
        expect(screen.queryByLabelText('Close details')).not.toBeInTheDocument();
    });

    it('forwards defaultLayout and layoutEpoch to PatternVisualizer for pattern data', () => {
        const defaultLayout = [{ id: 'n1', position: { x: 5, y: 10 } }];
        render(<Drawer data={patternData} defaultLayout={defaultLayout} layoutEpoch={3} />);

        expect(screen.getByTestId('pattern-visualizer')).toBeInTheDocument();
        expect(screen.getByTestId('pattern-default-layout')).toHaveTextContent(JSON.stringify(defaultLayout));
        expect(screen.getByTestId('pattern-layout-epoch')).toHaveTextContent('3');
    });

    it('forwards onPositionsChange to PatternVisualizer for pattern data', () => {
        const onPositionsChange = vi.fn();
        render(<Drawer data={patternData} onPositionsChange={onPositionsChange} />);

        screen.getByTestId('pattern-report-positions').click();

        expect(onPositionsChange).toHaveBeenCalledWith([{ id: 'n1', position: { x: 1, y: 2 } }]);
    });

    it('falls back to the name/calmType/id key when no viewportKeyOverride is given', () => {
        render(<Drawer data={calmData as unknown as Data} />);
        expect(screen.getByTestId('viewport-key')).toHaveTextContent(
            `${calmData.name}/${calmData.calmType}/${calmData.id}`
        );
    });

    it('does not collide when an architecture and a pattern share the same namespace and numeric id', () => {
        // Architecture ids and pattern ids come from independent counters, so an
        // Architecture 7 and a Pattern 7 can legitimately coexist in one namespace.
        // Without the calmType component in the fallback key, they would share one
        // scratch-position entry and one viewport entry.
        const architectureSeven: Data = { ...architectureData, id: '7' };
        const patternSeven: Data = { ...patternData, id: '7' };

        const architectureRender = render(<Drawer data={architectureSeven} />);
        const architectureKey = screen.getByTestId('viewport-key').textContent;
        architectureRender.unmount();

        render(<Drawer data={patternSeven} />);
        const patternKey = screen.getByTestId('viewport-key').textContent;

        expect(architectureKey).toBe('my-namespace/Architectures/7');
        expect(patternKey).toBe('my-namespace/Patterns/7');
        expect(architectureKey).not.toBe(patternKey);
    });

    it('uses the resolved viewportKeyOverride when one is provided', () => {
        render(<Drawer data={calmData as unknown as Data} viewportKeyOverride="my-namespace/42" />);
        expect(screen.getByTestId('viewport-key')).toHaveTextContent('my-namespace/42');
    });

    it('does not fall back to the name/id key when the override is explicitly null', () => {
        // null means the owner (useDefaultLayout) settled resolution with no match —
        // falling back to data.id here would key scratch storage and the server
        // layout off the raw slug, exactly the split the override exists to close.
        render(<Drawer data={calmData as unknown as Data} viewportKeyOverride={null} />);
        expect(screen.getByTestId('viewport-key')).toHaveTextContent('(none)');
    });

    it('surfaces an error (and does not throw) when a non-JSON file is dropped', async () => {
        render(<Drawer />);

        await act(async () => {
            await mockDropzone.onDrop?.([fakeFile('this is { not json')]);
        });

        expect(screen.getByText(/Couldn't read that file/i)).toBeInTheDocument();
        // Still resting on the empty state — the bad file was not accepted.
        expect(screen.getByTestId('dropzone-empty-state')).toBeInTheDocument();
        expect(screen.queryByTestId('reactflow-visualizer')).not.toBeInTheDocument();
    });

    it('clears the error and renders the diagram once a valid file is dropped', async () => {
        render(<Drawer />);

        await act(async () => {
            await mockDropzone.onDrop?.([fakeFile('not json')]);
        });
        expect(screen.getByText(/Couldn't read that file/i)).toBeInTheDocument();

        await act(async () => {
            await mockDropzone.onDrop?.([
                fakeFile(JSON.stringify({ nodes: [], relationships: [] })),
            ]);
        });

        expect(screen.queryByText(/Couldn't read that file/i)).not.toBeInTheDocument();
        expect(screen.getByTestId('reactflow-visualizer')).toBeInTheDocument();
    });

    it('classifies a catalog-only pattern (nodes via items, no prefixItems) dropped as a file as a pattern', async () => {
        render(<Drawer />);

        // A pattern whose nodes are declared solely through an `items` catalog has no
        // `prefixItems`. It must still be routed to the PatternVisualizer, not the
        // architecture ReactFlowVisualizer, on the file-upload path.
        await act(async () => {
            await mockDropzone.onDrop?.([
                fakeFile(
                    JSON.stringify({
                        properties: {
                            nodes: { items: { oneOf: [{ properties: { 'unique-id': { const: 'cache' } } }] } },
                        },
                    })
                ),
            ]);
        });

        expect(screen.getByTestId('pattern-visualizer')).toBeInTheDocument();
        expect(screen.queryByTestId('reactflow-visualizer')).not.toBeInTheDocument();
    });

    // Regression coverage for the dropped-file stale-layout bug: `defaultLayout`/
    // `layoutEpoch` describe the currently-*loaded* resource's saved server layout,
    // so they must collapse alongside `viewportKey` once a file is dropped —
    // otherwise a dropped file inherits the previously-loaded resource's positions.
    it('suppresses defaultLayout/layoutEpoch for a dropped pattern file', async () => {
        const defaultLayout = [{ id: 'n1', position: { x: 5, y: 10 } }];
        render(<Drawer data={patternData} defaultLayout={defaultLayout} layoutEpoch={3} />);

        expect(screen.getByTestId('pattern-default-layout')).toHaveTextContent(JSON.stringify(defaultLayout));
        expect(screen.getByTestId('pattern-layout-epoch')).toHaveTextContent('3');

        await act(async () => {
            await mockDropzone.onDrop?.([
                fakeFile(JSON.stringify({ properties: { nodes: { prefixItems: [] } } })),
            ]);
        });

        expect(screen.getByTestId('pattern-default-layout')).toHaveTextContent('(undefined)');
        expect(screen.getByTestId('pattern-layout-epoch')).toHaveTextContent('(none)');
    });

    it('suppresses defaultLayout/layoutEpoch for a dropped architecture file', async () => {
        const defaultLayout = [{ id: 'n1', position: { x: 5, y: 10 } }];
        render(<Drawer data={architectureData} defaultLayout={defaultLayout} layoutEpoch={3} />);

        expect(screen.getByTestId('architecture-default-layout')).toHaveTextContent(JSON.stringify(defaultLayout));
        expect(screen.getByTestId('architecture-layout-epoch')).toHaveTextContent('3');

        await act(async () => {
            await mockDropzone.onDrop?.([
                fakeFile(JSON.stringify({ nodes: [], relationships: [] })),
            ]);
        });

        expect(screen.getByTestId('architecture-default-layout')).toHaveTextContent('(undefined)');
        expect(screen.getByTestId('architecture-layout-epoch')).toHaveTextContent('(none)');
    });

    it('does not report a dropped pattern file\'s positions via onPositionsChange', async () => {
        const onPositionsChange = vi.fn();
        render(<Drawer data={patternData} onPositionsChange={onPositionsChange} />);

        await act(async () => {
            await mockDropzone.onDrop?.([
                fakeFile(JSON.stringify({ properties: { nodes: { prefixItems: [] } } })),
            ]);
        });

        expect(screen.getByTestId('pattern-report-positions')).toBeInTheDocument();
        // onPositionsChange itself is undefined once a file is dropped, so the mock's
        // report button has nothing to call — proven by the click being a no-op.
        screen.getByTestId('pattern-report-positions').click();
        expect(onPositionsChange).not.toHaveBeenCalled();
    });

    it('does not report a dropped architecture file\'s positions via onPositionsChange', async () => {
        const onPositionsChange = vi.fn();
        render(<Drawer data={architectureData} onPositionsChange={onPositionsChange} />);

        await act(async () => {
            await mockDropzone.onDrop?.([
                fakeFile(JSON.stringify({ nodes: [], relationships: [] })),
            ]);
        });

        screen.getByTestId('architecture-report-positions').click();
        expect(onPositionsChange).not.toHaveBeenCalled();
    });
});

describe('Drawer — decorator fetching', () => {
    beforeEach(() => {
        mockFetchDeploymentDecoratorsForArchitecture.mockReset();
        mockFetchDeploymentDecoratorsForArchitecture.mockResolvedValue([]);
    });

    it('delegates decorator fetching to the shared service method with namespace, id and version', async () => {
        render(<Drawer data={architectureData} />);

        await waitFor(() => {
            expect(mockFetchDeploymentDecoratorsForArchitecture).toHaveBeenCalledWith(
                'my-namespace',
                'my-arch',
                '1.0.0'
            );
        });
    });

    it('does not fetch decorator values when decorators prop is provided', async () => {
        render(<Drawer data={architectureData} decorators={[]} />);

        await new Promise((r) => setTimeout(r, 50));
        expect(mockFetchDeploymentDecoratorsForArchitecture).not.toHaveBeenCalled();
    });

    it('does not fetch decorator values for pattern data', async () => {
        render(<Drawer data={patternData} />);

        await new Promise((r) => setTimeout(r, 50));
        expect(mockFetchDeploymentDecoratorsForArchitecture).not.toHaveBeenCalled();
    });

    it('passes fetched decorators to MetadataPanel', async () => {
        const decorators = [{
            schema: 'https://calm.finos.org/draft/2026-03/standards/deployment/deployment.decorator.standard.json',
            uniqueId: 'dec-1',
            type: 'deployment',
            target: ['/api/calm/namespaces/my-namespace/architectures/my-arch/versions/1-0-0'],
            appliesTo: ['node-a'],
            data: {
                status: 'completed',
                'start-time': '2024-01-01T10:00:00Z',
                'end-time': '2024-01-01T10:05:00Z',
            },
        }];
        mockFetchDeploymentDecoratorsForArchitecture.mockResolvedValue(decorators);

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
            target: ['/api/calm/namespaces/my-namespace/architectures/my-arch/versions/1-0-0'],
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
        expect(mockFetchDeploymentDecoratorsForArchitecture).not.toHaveBeenCalled();
    });
});
