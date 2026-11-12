// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Node, Edge } from 'reactflow';
import type { CalmFlow } from '../core/types';
import { App } from './App';
import { useCanvasStore } from './stores/canvas-store';

const diagram = vi.hoisted(() => ({
    nodes: [] as Node[], edges: [] as Edge[],
    clearNodes: () => {}, clearEdges: () => {},
}));
const sent = vi.hoisted(() => vi.fn());
const exportSvg = vi.hoisted(() => vi.fn());

vi.mock('./vscode-api', () => ({ postMessage: sent }));
vi.mock('./features/import-export/useSvgExport', () => ({ useSvgExport: () => exportSvg }));
vi.mock('./canvas/nodeTypes', () => ({ nodeTypes: {} }));
vi.mock('./canvas/edgeTypes', () => ({ edgeTypes: {} }));
vi.mock('./panels/ToolbarMenu', () => ({
    ToolbarMenu: ({ items }: { items: Array<{ id: string; label: string; onClick: () => void }> }) =>
        <div>{items.map(item => <button key={item.id} onClick={item.onClick}>{item.label}</button>)}</div>,
}));
vi.mock('./panels/FlowList', () => ({
    FlowList: ({ flows, onFlowUpdate, onCreateFlowFromAll }: { flows: CalmFlow[]; onFlowUpdate: (id: string, updates: Partial<CalmFlow>) => void; onCreateFlowFromAll: () => void }) =>
        <div>
            <button onClick={() => onFlowUpdate(flows[0]['unique-id'], { name: 'Updated flow' })}>Edit flow</button>
            <button onClick={onCreateFlowFromAll}>Create flow</button>
        </div>,
}));
vi.mock('reactflow', async () => {
    const React = await import('react');
    const instance = {
        getNodes: () => diagram.nodes,
        getEdges: () => diagram.edges,
        fitView: vi.fn(),
        getZoom: () => 1,
        setCenter: vi.fn(),
        screenToFlowPosition: (p: { x: number; y: number }) => p,
    };
    return {
        default: function MockReactFlow({ nodes, edges, onEdgeContextMenu }: { nodes: Node[]; edges: Edge[]; onEdgeContextMenu: (event: React.MouseEvent, edge: Edge) => void }) {
            React.useEffect(() => {
                diagram.nodes = nodes;
                diagram.edges = edges;
                return () => { diagram.nodes = []; diagram.edges = []; };
            }, [nodes, edges]);
            return <div data-architecture-canvas=""><button onClick={event => onEdgeContextMenu(event, edges[0])}>Edge menu</button></div>;
        },
        ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
        Background: () => null,
        Controls: () => null,
        MiniMap: () => null,
        MarkerType: { ArrowClosed: 'arrowclosed' },
        useNodesState: () => {
            const [nodes, setNodes] = React.useState<Node[]>([]);
            React.useEffect(() => { diagram.clearNodes = () => setNodes([]); }, [setNodes]);
            return [nodes, setNodes, vi.fn()];
        },
        useEdgesState: () => {
            const [edges, setEdges] = React.useState<Edge[]>([]);
            React.useEffect(() => { diagram.clearEdges = () => setEdges([]); }, [setEdges]);
            return [edges, setEdges, vi.fn()];
        },
        useReactFlow: () => instance,
        addEdge: vi.fn(),
        updateEdge: vi.fn(),
        getRectOfNodes: vi.fn(),
    };
});

const model = {
    nodes: [
        { 'unique-id': 'ui', 'node-type': 'webclient', name: 'UI', description: '' },
        { 'unique-id': 'api', 'node-type': 'service', name: 'API', description: '', 'definition-id': 'finos:standards:api@sha', metadata: { 'standard-node-style': { background: '#123456', text: '#ffffff' } } },
    ],
    relationships: [{ 'unique-id': 'request', 'relationship-type': { connects: { source: { node: 'ui' }, destination: { node: 'api' } } } }],
    flows: [{ 'unique-id': 'checkout', name: 'Checkout', description: '', transitions: [{ 'relationship-unique-id': 'request', 'sequence-number': 1, description: 'Call API' }] }],
};

const response = { 'unique-id': 'response', 'relationship-type': { connects: { source: { node: 'api' }, destination: { node: 'ui' } } } };

describe('flow integration with current standard nodes', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(async () => {
        vi.useFakeTimers();
        vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
        Object.assign(window, {
            __INITIAL_CALM_JSON__: JSON.stringify(model),
            __CALM_ENABLED_FEATURES__: [
                'flows',
                'validation',
                'patterns',
                'export-pattern',
                'standards-controls',
                'generate-spec',
                'import-export',
            ],
        });
        useCanvasStore.setState(useCanvasStore.getInitialState(), true);
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => root.render(<App />));
        await act(async () => vi.runOnlyPendingTimers());
        sent.mockClear();
        exportSvg.mockClear();
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    async function click(label: string) {
        const button = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.trim() === label);
        expect(button, label).toBeDefined();
        await act(async () => button?.click());
        await act(async () => vi.runOnlyPendingTimers());
    }

    async function sequenceMode() {
        const button = container.querySelector<HTMLButtonElement>('button[title="Switch to Sequence Diagram view"]');
        expect(button).not.toBeNull();
        await act(async () => button?.click());
        expect(diagram.nodes).toEqual([]);
        expect(container.querySelector('[data-sequence-svg]')).not.toBeNull();
    }

    async function loadModel(json: string) {
        await act(async () => window.dispatchEvent(new MessageEvent('message', { data: { type: 'modelUpdated', json, source: 'text-editor' } })));
        await act(async () => vi.runOnlyPendingTimers());
        sent.mockClear();
    }

    async function clickControl(title: string) {
        const button = container.querySelector<HTMLButtonElement>(`button[title="${title}"]`);
        expect(button).not.toBeNull();
        expect(button?.disabled).toBe(false);
        await act(async () => button?.click());
    }

    it('hides optional features and preserves their model data when disabled', async () => {
        await act(async () => root.unmount());
        useCanvasStore.setState(useCanvasStore.getInitialState(), true);
        Object.assign(window, {
            __INITIAL_CALM_JSON__: JSON.stringify(model),
            __CALM_ENABLED_FEATURES__: [],
        });
        root = createRoot(container);
        await act(async () => root.render(<App />));
        await act(async () => vi.runOnlyPendingTimers());
        sent.mockClear();

        expect(container.querySelector('button[title="Switch to Sequence Diagram view"]')).toBeNull();
        expect(Array.from(container.querySelectorAll('button')).some(button => button.textContent?.trim() === 'Validate')).toBe(false);
        expect(Array.from(container.querySelectorAll('button')).some(button => button.textContent?.trim() === 'Export SVG')).toBe(false);
        expect(Array.from(container.querySelectorAll('[role="menuitem"]')).some(item => item.textContent?.trim() === 'Export as Pattern')).toBe(false);

        await click('↓ Layout');
        const change = sent.mock.calls.map(([message]) => message).find(message => message.type === 'canvasChanged');
        expect(change?.type).toBe('canvasChanged');
        if (change?.type === 'canvasChanged') {
            expect(JSON.parse(change.json).flows[0]['unique-id']).toBe('checkout');
        }
    });

    it('keeps core palette drop and JSON synchronization working with no optional features', async () => {
        await act(async () => root.unmount());
        useCanvasStore.setState(useCanvasStore.getInitialState(), true);
        Object.assign(window, {
            __INITIAL_CALM_JSON__: JSON.stringify(model),
            __CALM_ENABLED_FEATURES__: [],
        });
        root = createRoot(container);
        await act(async () => root.render(<App />));
        await act(async () => vi.runOnlyPendingTimers());
        sent.mockClear();

        const payload = new Map([
            ['application/calm-node-type', 'service'],
            ['application/calm-node-label', 'Core drop'],
        ]);
        const dropEvent = new MouseEvent('drop', { bubbles: true, cancelable: true, clientX: 24, clientY: 36 });
        Object.defineProperty(dropEvent, 'dataTransfer', {
            value: { getData: (type: string) => payload.get(type) ?? '' },
        });
        const canvas = container.querySelector('[data-architecture-canvas]');
        expect(canvas).not.toBeNull();

        await act(async () => canvas?.dispatchEvent(dropEvent));
        await act(async () => vi.runOnlyPendingTimers());

        const change = sent.mock.calls.map(([message]) => message).find(message => message.type === 'canvasChanged');
        expect(change?.type).toBe('canvasChanged');
        if (change?.type === 'canvasChanged') {
            const architecture = JSON.parse(change.json);
            expect(architecture.nodes.some((node: { name: string }) => node.name === 'Core drop')).toBe(true);
            expect(architecture.flows[0]['unique-id']).toBe('checkout');
        }
    });

    it('enables Export as Pattern independently from pattern authoring', async () => {
        await act(async () => root.unmount());
        useCanvasStore.setState(useCanvasStore.getInitialState(), true);
        Object.assign(window, {
            __INITIAL_CALM_JSON__: JSON.stringify(model),
            __CALM_ENABLED_FEATURES__: ['export-pattern'],
        });
        root = createRoot(container);
        await act(async () => root.render(<App />));
        await act(async () => vi.runOnlyPendingTimers());
        sent.mockClear();

        expect(Array.from(container.querySelectorAll('button')).some(button => button.textContent?.trim() === 'Apply Pattern')).toBe(false);
        await click('Export as Pattern');
        expect(sent.mock.calls.some(([message]) => message.type === 'requestExportPattern')).toBe(true);
    });

    it('dispatches enabled validation, generation, and import/export actions', async () => {
        await click('Validate');
        expect(container.textContent).toContain('Validation Results');

        await click('Generate Spec');
        await click('Export SVG');
        await click('Import SVG');
        await click('Export Bundle');
        await click('Import Bundle');

        expect(exportSvg).toHaveBeenCalledOnce();
        expect(sent.mock.calls.map(([message]) => message.type)).toEqual(expect.arrayContaining([
            'requestGenerateSpec',
            'requestImportSvg',
            'requestExportBundle',
            'requestImportBundle',
        ]));
    });

    it('opens feature-owned pattern and standards/control surfaces from their actions', async () => {
        await click('Apply Pattern');
        expect(container.textContent).toContain('Apply Pattern');
        const patternClose = container.querySelector<HTMLButtonElement>('[style*="position: fixed"] button');
        expect(patternClose).not.toBeNull();
        await act(async () => patternClose?.click());

        await click('New from Pattern');
        expect(container.textContent).toContain('New from Pattern');
        const newPatternClose = container.querySelector<HTMLButtonElement>('[style*="position: fixed"] button');
        await act(async () => newPatternClose?.click());

        await click('Create Node');
        expect(container.querySelector('[aria-label="Create Standard Node"]')).not.toBeNull();
        const standardNodeClose = container.querySelector<HTMLButtonElement>('[aria-label="Create Standard Node"] button');
        await act(async () => standardNodeClose?.click());

        await click('Create Control');
        expect(container.querySelector('[aria-label="Create Control Requirement"]')).not.toBeNull();
    });

    async function loadPlaybackModel() {
        await loadModel(JSON.stringify({
            ...model,
            nodes: [...model.nodes, { 'unique-id': 'db', 'node-type': 'database', name: 'DB', description: '' }],
            relationships: [
                ...model.relationships,
                { 'unique-id': 'query', 'relationship-type': { connects: { source: { node: 'api' }, destination: { node: 'db' } } } },
                { 'unique-id': 'unrelated', 'relationship-type': { connects: { source: { node: 'ui' }, destination: { node: 'db' } } } },
            ],
            flows: [{
                ...model.flows[0],
                transitions: [
                    { 'relationship-unique-id': 'request', 'sequence-number': 2, description: 'Call' },
                    { 'relationship-unique-id': 'query', 'sequence-number': 2, description: 'Parallel query' },
                    { 'relationship-unique-id': 'request', 'sequence-number': 4, description: 'Return', direction: 'destination-to-source' },
                    { 'relationship-unique-id': 'query', 'sequence-number': 6, description: 'Query again' },
                ],
            }],
        }));
        await act(async () => useCanvasStore.getState().setActiveFlowId('checkout'));
    }

    it('plays parallel and reverse architecture transitions with idle highlighting disabled', async () => {
        await loadPlaybackModel();
        expect(useCanvasStore.getState().flowHighlightEnabled).toBe(false);
        await clickControl('Play');
        expect(diagram.edges.filter(e => e.data._flowActive).map(e => e.id)).toEqual(['request', 'query']);
        expect(diagram.edges.find(e => e.id === 'unrelated')?.data._flowDimmed).toBe(true);
        await act(async () => vi.advanceTimersByTime(1500));
        expect(diagram.edges.find(e => e.id === 'request')?.data).toMatchObject({
            _flowActive: true, _flowDirections: ['reverse'], _flowVisited: false,
        });
        expect(diagram.edges.find(e => e.id === 'query')?.data).toMatchObject({
            _flowActive: false, _flowVisited: true,
        });
        await clickControl('Pause');
        await act(async () => vi.advanceTimersByTime(3000));
        expect(container.textContent).toContain('(2/3)');
        expect(diagram.edges.find(e => e.id === 'request')?.data._flowActive).toBe(true);
        await clickControl('Next step');
        expect(diagram.edges.find(e => e.id === 'query')?.data._flowActive).toBe(true);
        await clickControl('Stop and clear');
        expect(diagram.edges.every(e => !e.data._flowActive && !e.data._flowVisited && !e.data._flowDimmed)).toBe(true);
        expect(useCanvasStore.getState().flowHighlightEnabled).toBe(false);
        expect(sent.mock.calls.some(([message]) => message.type === 'canvasChanged')).toBe(false);
    });

    it('retains the current step when switching diagram views and stepping backwards', async () => {
        await loadPlaybackModel();
        await clickControl('Next step');
        await sequenceMode();
        expect(container.querySelectorAll('circle[r="4"]')).toHaveLength(2);
        await clickControl('Next step');
        expect(container.querySelectorAll('circle[r="4"]')).toHaveLength(1);
        const returnArrow = container.querySelectorAll<SVGLineElement>('line[marker-end]')[2];
        expect(Number(returnArrow.getAttribute('x1'))).toBeGreaterThan(Number(returnArrow.getAttribute('x2')));
        await clickControl('Switch to Architecture view');
        expect(diagram.edges.find(e => e.id === 'request')?.data._flowDirections).toEqual(['reverse']);
        await clickControl('Previous step');
        expect(diagram.edges.filter(e => e.data._flowActive)).toHaveLength(2);
        expect(sent.mock.calls.some(([message]) => message.type === 'canvasChanged')).toBe(false);
    });

    it('restores static overview highlighting on stop when the checkbox is enabled', async () => {
        await loadPlaybackModel();
        await act(async () => useCanvasStore.getState().setFlowHighlightEnabled(true));
        await clickControl('Play');
        await clickControl('Stop and clear');
        expect(diagram.edges.find(e => e.id === 'request')?.data).toMatchObject({
            _flowActive: false, _flowVisited: false, _flowColor: '#60a5fa',
        });
        expect(diagram.edges.find(e => e.id === 'unrelated')?.data._flowDimmed).toBe(true);
    });

    it('uses reverse relationship orientation without reversing a return transition twice', async () => {
        await loadModel(JSON.stringify({
            ...model, relationships: [...model.relationships, response],
            flows: [{ ...model.flows[0], transitions: [
                { 'relationship-unique-id': 'response', 'sequence-number': 1, description: 'Response' },
                { 'relationship-unique-id': 'response', 'sequence-number': 2, description: 'Reverse response', direction: 'destination-to-source' },
            ] }],
        }));
        await act(async () => useCanvasStore.getState().setActiveFlowId('checkout'));
        await clickControl('Next step');
        expect(diagram.edges[0].data._flowDirections).toEqual(['reverse']);
        await clickControl('Next step');
        expect(diagram.edges[0].data._flowDirections).toEqual(['forward']);
    });

    it('highlights every architecture branch of a multi-target interaction', async () => {
        await loadModel(JSON.stringify({
            ...model,
            nodes: [...model.nodes, { 'unique-id': 'db', 'node-type': 'database', name: 'DB', description: '' }],
            relationships: [{ 'unique-id': 'interaction', 'relationship-type': { interacts: { actor: 'ui', nodes: ['api', 'db'] } } }],
            flows: [{ ...model.flows[0], transitions: [{ 'relationship-unique-id': 'interaction', 'sequence-number': 1, description: '' }] }],
        }));
        await act(async () => useCanvasStore.getState().setActiveFlowId('checkout'));
        await clickControl('Next step');
        expect(diagram.edges).toHaveLength(2);
        expect(diagram.edges.every(e => e.data._flowActive)).toBe(true);
        expect(diagram.nodes.every(n => n.style?.opacity === 1)).toBe(true);
    });

    it('respects speed, pause/resume, completion, and flow-selection reset', async () => {
        await loadPlaybackModel();
        const speed = container.querySelector<HTMLSelectElement>('select[title="Playback speed"]')!;
        await act(async () => {
            speed.value = '2';
            speed.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await clickControl('Play');
        await act(async () => vi.advanceTimersByTime(750));
        expect(container.textContent).toContain('(2/3)');
        await clickControl('Pause');
        await clickControl('Play');
        await act(async () => vi.advanceTimersByTime(750));
        expect(container.textContent).toContain('(3/3)');
        await act(async () => vi.advanceTimersByTime(750));
        expect(container.textContent).toContain('(0/3)');
        expect(container.querySelector('button[title="Play"]')).not.toBeNull();
        await clickControl('Play');
        expect(container.textContent).toContain('(1/3)');
        await act(async () => useCanvasStore.getState().setActiveFlowId(null));
        expect(container.textContent).toContain('Idle');
        expect(container.querySelector<HTMLButtonElement>('button[title="Play"]')?.disabled).toBe(true);
        expect(diagram.edges.every(e => !e.data._flowActive)).toBe(true);
    });

    it('disables playback for no flow, all flows, and an empty flow', async () => {
        expect(container.querySelector<HTMLButtonElement>('button[title="Play"]')?.disabled).toBe(true);
        await act(async () => useCanvasStore.getState().setActiveFlowId('__all__'));
        expect(container.querySelector<HTMLButtonElement>('button[title="Play"]')?.disabled).toBe(true);
        await act(async () => {
            useCanvasStore.getState().updateFlow('checkout', { transitions: [] });
            useCanvasStore.getState().setActiveFlowId('checkout');
        });
        expect(container.querySelector<HTMLButtonElement>('button[title="Play"]')?.disabled).toBe(true);
    });

    it('preserves nodes, relationships, and standard-node appearance when editing in sequence view', async () => {
        await sequenceMode();
        await click('Edit flow');
        const message = sent.mock.calls.map(([m]) => m).find(m => m.type === 'canvasChanged');
        expect(message).toBeDefined();
        const updated = JSON.parse(message.json);
        expect(updated.nodes.map((n: Record<string, unknown>) => n['unique-id'])).toEqual(['ui', 'api']);
        expect(updated.relationships).toHaveLength(1);
        expect(updated.flows[0].name).toBe('Updated flow');
        expect(updated.nodes[1].metadata['standard-node-style'].background).toBe('#123456');
    });

    it('exports the complete architecture and flows from sequence view', async () => {
        await sequenceMode();
        await click('Export as Pattern');
        const message = sent.mock.calls.map(([m]) => m).find(m => m.type === 'requestExportPattern');
        const exported = JSON.parse(message.doc);
        expect(exported.nodes).toHaveLength(2);
        expect(exported.relationships).toHaveLength(1);
        expect(exported.flows).toEqual(model.flows);
    });

    it('clears flows and returns to architecture view when the document is blank', async () => {
        await sequenceMode();
        await act(async () => window.dispatchEvent(new MessageEvent('message', { data: { type: 'modelUpdated', json: '', source: 'text-editor' } })));
        expect(useCanvasStore.getState()).toMatchObject({ flows: [], activeFlowId: null, canvasMode: 'architecture' });
        expect(container.querySelector('[data-sequence-svg]')).toBeNull();
    });

    it('does not restore deleted nodes or edges from retained state in architecture mode', async () => {
        await act(async () => { diagram.clearNodes(); diagram.clearEdges(); });
        await click('Edit flow');
        const message = sent.mock.calls.map(([m]) => m).find(m => m.type === 'canvasChanged');
        const updated = JSON.parse(message.json);
        expect(updated.nodes).toEqual([]);
        expect(updated.relationships).toEqual([]);
    });

    it('creates a flow from retained relationships in sequence view', async () => {
        await sequenceMode();
        await click('Create flow');
        const flow = useCanvasStore.getState().flows[1];
        expect(flow.transitions[0]['relationship-unique-id']).toBe('request');
    });

    it('creates bidirectional steps without reversing the return relationship twice', async () => {
        await loadModel(JSON.stringify({ ...model, relationships: [...model.relationships, response] }));
        await sequenceMode();
        await click('Create flow');
        const flow = useCanvasStore.getState().flows[1];
        expect(flow.transitions).toHaveLength(2);
        expect(flow.transitions[1]).toMatchObject({ 'relationship-unique-id': 'request', direction: 'destination-to-source' });
        const arrows = container.querySelectorAll<SVGLineElement>('line[marker-end]');
        expect(arrows).toHaveLength(2);
        expect(Number(arrows[0].getAttribute('x1'))).toBeLessThan(Number(arrows[0].getAttribute('x2')));
        expect(Number(arrows[1].getAttribute('x1'))).toBeGreaterThan(Number(arrows[1].getAttribute('x2')));
    });

    it('removes flow membership identified by the reverse relationship', async () => {
        await loadModel(JSON.stringify({
            ...model, relationships: [...model.relationships, response],
            flows: [{ ...model.flows[0], transitions: [{ 'relationship-unique-id': 'response', 'sequence-number': 1, description: '' }] }],
        }));
        await click('Edge menu');
        await click('Checkout');
        expect(useCanvasStore.getState().flows[0].transitions[0]['relationship-unique-id']).toBe('');
    });

    it('does not expose flow editing from a read-only canvas', async () => {
        await act(async () => useCanvasStore.setState({ readonlyMode: true }));
        await click('Edge menu');
        expect(container.textContent).not.toContain('Remove from Flow');
        expect(useCanvasStore.getState().flows).toEqual(model.flows);
    });
});
