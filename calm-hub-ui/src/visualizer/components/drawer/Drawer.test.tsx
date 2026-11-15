import { BUILTIN_DECORATOR_VIEWS } from '../../../test-support/decorator-views.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { Drawer } from './Drawer.js';
import { Data } from '../../../model/calm.js';
import type { Decorator, DecoratorView, ReactFlowVisualizerProps } from '../../contracts/contracts.js';
import { createMemoryStorage } from '../../../test-support/memory-storage.js';
import { fakeView } from '../../../test-support/fake-overlays.js';
import type { PatternVisualizerProps } from '../reactflow/PatternVisualizer.js';
import { DropzoneOptions } from 'react-dropzone';

const registered = vi.hoisted(() => ({ views: undefined as DecoratorView[] | undefined }));
vi.mock('../../overlay/decoratorViews.js', () => ({ useDecoratorViews: () => registered.views ?? BUILTIN_DECORATOR_VIEWS }));

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

vi.mock('../reactflow/MetadataPanel.js', () => ({
    MetadataPanel: ({ evaluations, evaluationOverlay }: { evaluations?: unknown[]; evaluationOverlay?: { map?: Record<string, string> } }) => (
        <div data-testid="metadata-panel">
            evaluations:{evaluations?.length ?? 0}
            <span data-testid="evaluation-overlay-map">{JSON.stringify(evaluationOverlay?.map ?? null)}</span>
        </div>
    ),
}));

// Mock dependencies
vi.mock('../reactflow/ReactFlowVisualizer.js', async () => {
    const { useElementEvaluation, useElementOverlays, useDecoratorOverlays } =
        await vi.importActual<typeof import('../../context/DecoratorOverlayContext.js')>('../../context/DecoratorOverlayContext.js');
    // Reads node n1's and container sys's overlays from the context the Drawer provides, as CustomNode and
    // SystemGroupNode do.
    const EvaluationProbe = () => {
        const { overlays, toggleView, onOpenView } = useDecoratorOverlays();
        return (
            <>
                <div data-testid="evaluation-n1">{useElementEvaluation('n1')?.status ?? '(none)'}</div>
                <div data-testid="evaluation-sys">{useElementEvaluation('sys')?.status ?? '(none)'}</div>
                <div data-testid="overlays-n1">
                    {useElementOverlays('n1').map(({ view, overlay }) => `${view.id}:${overlay.status}`).join(' ') || '(none)'}
                </div>
                <div data-testid="overlay-views">{overlays.map(({ view }) => view.id).join(' ') || '(none)'}</div>
                <button onClick={() => toggleView('deployment/deployment')}>toggle-deployment</button>
                <button onClick={() => onOpenView?.(overlays[0].view)}>open-first-view</button>
            </>
        );
    };
    return {
        ReactFlowVisualizer: ({ calmData, viewportKey, defaultLayout, layoutEpoch, onPositionsChange }: ReactFlowVisualizerProps) => {
            return (
                <div data-testid="reactflow-visualizer">
                    <EvaluationProbe />
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
            );
        },
    };
});
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

describe('Drawer — dropped files', () => {
    it('reports whether a dropped file replaces the loaded resource, and false on unmount', async () => {
        const onDroppedFileChange = vi.fn();
        const { unmount } = render(<Drawer data={architectureData} onDroppedFileChange={onDroppedFileChange} />);
        expect(onDroppedFileChange).toHaveBeenLastCalledWith(false);

        await act(async () => {
            await mockDropzone.onDrop?.([fakeFile(JSON.stringify({ nodes: [], relationships: [] }))]);
        });
        expect(onDroppedFileChange).toHaveBeenLastCalledWith(true);

        unmount();
        expect(onDroppedFileChange).toHaveBeenLastCalledWith(false);
    });
});

describe('Drawer — decorator overlays', () => {
    const architectureWithNode: Data = {
        ...architectureData,
        data: { nodes: [{ 'unique-id': 'n1', name: 'Node 1', description: 'd', 'node-type': 'service' }], relationships: [] },
    };

    const evaluation = (status: 'met' | 'not-met') => ({
        schema: 's',
        uniqueId: `eval-${status}`,
        type: 'control-evaluation',
        target: ['/calm/namespaces/my-namespace/architectures/my-arch/versions/1.0.0'],
        appliesTo: ['n1'],
        data: {
            control: { 'unique-id': 'client-ledger-human-approval', 'requirement-url': 'https://example.org/r' },
            status,
            'evaluated-at': '2026-11-04T15:00:00Z',
        },
    }) as unknown as Decorator;

    const deployment = (status: string) => ({
        uniqueId: `dep-${status}`,
        type: 'deployment',
        target: [],
        appliesTo: ['n1'],
        data: { status, 'start-time': '2026-11-04T15:00:00Z' },
    }) as unknown as Decorator;

    const risk = (uniqueId: string) => ({
        uniqueId, type: 'risk', target: [], appliesTo: ['n1'], data: { status: 'high', at: '2026-11-04T15:00:00Z' },
    }) as unknown as Decorator;

    beforeEach(() => {
        registered.views = undefined;
    });

    it('hands each node\'s latest evaluation to the diagram through the context, and lists them in the metadata panel', () => {
        render(<Drawer data={architectureWithNode} decorators={[evaluation('not-met')]} />);

        expect(screen.getByTestId('evaluation-n1')).toHaveTextContent('not-met');
        expect(screen.getByTestId('metadata-panel')).toHaveTextContent('evaluations:1');
    });

    it('hands a containment relationship\'s evaluation to its container, which draws it', () => {
        const architectureWithContainer: Data = {
            ...architectureData,
            data: {
                nodes: [
                    { 'unique-id': 'sys', name: 'System', description: 'd', 'node-type': 'system' },
                    { 'unique-id': 'n1', name: 'Node 1', description: 'd', 'node-type': 'service' },
                ],
                relationships: [
                    { 'unique-id': 'sys-has-n1', 'relationship-type': { 'composed-of': { container: 'sys', nodes: ['n1'] } } },
                ],
            },
        };
        render(<Drawer data={architectureWithContainer} decorators={[{ ...evaluation('not-met'), appliesTo: ['sys-has-n1'] }]} />);

        expect(screen.getByTestId('evaluation-sys')).toHaveTextContent('not-met');
        expect(screen.getByTestId('evaluation-n1')).toHaveTextContent('(none)');
    });

    it('shows a new decorator list from its owner', () => {
        const { rerender } = render(<Drawer data={architectureWithNode} decorators={[evaluation('not-met')]} />);
        expect(screen.getByTestId('evaluation-n1')).toHaveTextContent('not-met');

        rerender(<Drawer data={architectureWithNode} decorators={[evaluation('met')]} />);

        expect(screen.getByTestId('evaluation-n1')).toHaveTextContent('met');
        expect(screen.getByTestId('evaluation-n1')).not.toHaveTextContent('not-met');
    });

    it('draws no decorators for a pattern', () => {
        render(<Drawer data={patternData} decorators={[evaluation('not-met')]} />);
        expect(screen.queryByTestId('metadata-panel')).not.toBeInTheDocument();
    });

    it('clears the overlays once a file is dropped over an architecture', async () => {
        render(<Drawer data={architectureWithNode} decorators={[evaluation('not-met')]} />);
        expect(screen.getByTestId('evaluation-n1')).toHaveTextContent('not-met');

        await act(async () => {
            await mockDropzone.onDrop?.([
                fakeFile(JSON.stringify({ nodes: [{ 'unique-id': 'n1', name: 'Node 1', description: 'd', 'node-type': 'service' }], relationships: [] })),
            ]);
        });

        expect(screen.getByTestId('evaluation-n1')).toHaveTextContent('(none)');
    });

    it('draws every view with decorators on an element, and leaves views with none off the legend', () => {
        const { rerender } = render(<Drawer data={architectureWithNode} decorators={[deployment('failed')]} />);

        expect(screen.getByTestId('overlays-n1')).toHaveTextContent('deployment:error');
        expect(screen.getByTestId('overlay-views')).toHaveTextContent(/^deployment$/);
        expect(screen.getByTestId('evaluation-n1')).toHaveTextContent('(none)');

        rerender(<Drawer data={architectureWithNode} decorators={[deployment('failed'), evaluation('met')]} />);

        expect(screen.getByTestId('overlays-n1')).toHaveTextContent('control-evaluation:ok deployment:error');
        expect(screen.getByTestId('metadata-panel')).toHaveTextContent('evaluations:1');
    });

    it('hides a view that the legend turns off, and shows it again when turned back on', async () => {
        render(<Drawer data={architectureWithNode} decorators={[evaluation('not-met'), deployment('completed')]} storage={createMemoryStorage()} />);
        expect(screen.getByTestId('overlays-n1')).toHaveTextContent('control-evaluation:error deployment:ok');

        await act(async () => { screen.getByText('toggle-deployment').click(); });
        expect(screen.getByTestId('overlays-n1')).toHaveTextContent(/^control-evaluation:error$/);
        expect(screen.getByTestId('overlay-views')).toHaveTextContent('control-evaluation deployment');

        await act(async () => { screen.getByText('toggle-deployment').click(); });
        expect(screen.getByTestId('overlays-n1')).toHaveTextContent('control-evaluation:error deployment:ok');
    });

    it('keeps a view off by default when a later refresh draws views that sort before it', () => {
        const views = ['ext-1', 'ext-2', 'ext-3', 'ext-4'].map((id) => ({ ...fakeView(id, `${id}-risk`), match: { type: `${id}-risk` } }));
        registered.views = [...views, ...BUILTIN_DECORATOR_VIEWS];
        const of = (extension: string) => ({ ...risk(`${extension}-d`), type: `${extension}-risk` }) as Decorator;
        const storage = createMemoryStorage();
        const { rerender } = render(<Drawer data={architectureWithNode} decorators={[of('ext-4'), evaluation('met')]} storage={storage} />);

        expect(screen.getByTestId('overlays-n1')).toHaveTextContent(/^control-evaluation:ok$/);

        rerender(<Drawer data={architectureWithNode} decorators={[of('ext-1'), of('ext-4'), evaluation('met')]} storage={storage} />);

        expect(screen.getByTestId('overlays-n1')).toHaveTextContent(/^ext-1-risk:error control-evaluation:ok$/);
    });

    it('takes the evaluation history from the built-in view only', () => {
        registered.views = [{ ...fakeView('ops', 'control-evaluation'), match: { type: 'control-evaluation' } }];
        render(<Drawer data={architectureWithNode} decorators={[evaluation('not-met')]} />);

        expect(screen.queryByTestId('metadata-panel')).not.toBeInTheDocument();
        expect(screen.getByTestId('evaluation-n1')).toHaveTextContent('(none)');
    });

    it('gives the metadata panel the built-in control-evaluation overlay, not an operator view with the same id', () => {
        registered.views = [
            { ...fakeView('ops', 'control-evaluation'), match: { type: 'control-evaluation' }, overlay: { status: '/status', map: { met: 'error' } } },
            ...BUILTIN_DECORATOR_VIEWS,
        ];
        render(<Drawer data={architectureWithNode} decorators={[evaluation('met')]} />);

        expect(screen.getByTestId('evaluation-overlay-map')).toHaveTextContent(JSON.stringify({ met: 'ok', 'not-met': 'error' }));
    });

    it('passes onOpenView to the overlay legend', async () => {
        const onOpenView = vi.fn();
        render(<Drawer data={architectureWithNode} decorators={[deployment('completed')]} onOpenView={onOpenView} />);

        await act(async () => { screen.getByText('open-first-view').click(); });
        expect(onOpenView).toHaveBeenCalledWith(expect.objectContaining({ id: 'deployment' }));
    });
});
