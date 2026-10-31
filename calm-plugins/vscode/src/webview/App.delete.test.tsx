// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Node, Edge, NodeChange, EdgeChange } from 'reactflow';

// The canvas is drawn by ReactFlow, which needs a real layout. Capture its props instead,
// and play the callbacks in the order ReactFlow calls them.
type FlowProps = {
    nodes: Node[];
    edges: Edge[];
    onNodesDelete: (nodes: Node[]) => void;
    onNodesChange: (changes: NodeChange[]) => void;
    onEdgesChange: (changes: EdgeChange[]) => void;
    onNodeClick: (event: unknown, node: Node) => void;
    onDrop: (event: unknown) => void;
};
let flow: FlowProps;
vi.mock('reactflow', async () => {
    const actual = await vi.importActual<typeof import('reactflow')>('reactflow');
    return {
        ...actual,
        __esModule: true,
        default: (props: FlowProps) => {
            flow = props;
            return null;
        },
        Background: () => null,
        Controls: () => null,
        MiniMap: () => null,
        useReactFlow: () => ({
            getNodes: () => flow?.nodes ?? [],
            getEdges: () => flow?.edges ?? [],
            screenToFlowPosition: (p: { x: number; y: number }) => p,
            fitView: () => undefined,
        }),
    };
});
vi.mock('html-to-image', () => ({ toSvg: vi.fn() }));

const posted: { type: string; json?: string }[] = [];
vi.stubGlobal('acquireVsCodeApi', () => ({ postMessage: (m: { type: string }) => posted.push(m), getState: () => undefined, setState: () => undefined }));

const { App } = await import('./App');

const node = (id: string) => ({ 'unique-id': id, 'node-type': 'system', name: id, description: id });
const deployedIn = (id: string, container: string, nodes: string[]) =>
    ({ 'unique-id': id, 'relationship-type': { 'deployed-in': { container, nodes } } });
const connects = (id: string, source: string, destination: string) =>
    ({ 'unique-id': id, 'relationship-type': { connects: { source: { node: source }, destination: { node: destination } } } });

let root: Root;
const open = (arch: object) => {
    (window as unknown as { __INITIAL_CALM_JSON__?: string }).__INITIAL_CALM_JSON__ = JSON.stringify(arch);
    const el = document.createElement('div');
    document.body.appendChild(el);
    act(() => {
        root = createRoot(el);
        root.render(<App />);
    });
    act(() => vi.runAllTimers());
    posted.length = 0;
};
// ReactFlow deletes the picked drawings and those nested in them. It calls onEdgesChange for their edges,
// then onNodesDelete, then onNodesChange.
const deleteDrawings = (picked: string[]) => {
    const ids = new Set(picked);
    for (let grew = true; grew;) {
        grew = false;
        for (const n of flow.nodes) if (n.parentId && ids.has(n.parentId) && !ids.has(n.id)) { ids.add(n.id); grew = true; }
    }
    const deleted = flow.nodes.filter((n) => ids.has(n.id));
    const deletedEdges = flow.edges.filter((e) => ids.has(e.source) || ids.has(e.target));
    act(() => {
        if (deletedEdges.length > 0) flow.onEdgesChange(deletedEdges.map((e) => ({ id: e.id, type: 'remove' })));
        flow.onNodesDelete(deleted);
        flow.onNodesChange(deleted.map((n) => ({ id: n.id, type: 'remove' })));
    });
    // Both queued saves run before React draws again
    act(() => vi.runAllTimers());
};
const saves = () => posted.filter((m) => m.type === 'canvasChanged').map((m) => JSON.parse(m.json!));
const lastSave = () => saves()[saves().length - 1];
const containment = (arch: { relationships: Record<string, any>[] }) =>
    arch.relationships.filter((r) => r['relationship-type']['deployed-in']).map((r) => [r['unique-id'], r['relationship-type']['deployed-in'].nodes]);

beforeEach(() => {
    vi.useFakeTimers();
    posted.length = 0;
});
afterEach(() => {
    act(() => root.unmount());
    vi.useRealTimers();
});

describe('App: edits on a canvas with copies', () => {
    const sharedNamespace = {
        nodes: [node('cluster-a'), node('cluster-b'), node('ns'), node('svc'), node('client')],
        relationships: [
            deployedIn('r1', 'cluster-a', ['ns']),
            deployedIn('r2', 'cluster-b', ['ns']),
            deployedIn('r3', 'ns', ['svc']),
            connects('c1', 'client', 'svc'),
        ],
    };

    it('saves once, keeps the nodes in the other drawings, and rebuilds the canvas', () => {
        open(sharedNamespace);
        const copy = flow.nodes.find((n) => n.id !== 'ns' && n.data.calmId === 'ns')!;
        deleteDrawings([copy.id]);

        expect(saves()).toHaveLength(1);
        const [saved] = saves();
        expect(saved.nodes.map((n: { 'unique-id': string }) => n['unique-id'])).toEqual(['cluster-a', 'cluster-b', 'ns', 'svc', 'client']);
        expect(containment(saved)).toContainEqual(['r3', ['svc']]);
        expect(saved.relationships.map((r: { 'unique-id': string }) => r['unique-id'])).toContain('c1');
        // The canvas is rebuilt from the saved file: ns is now drawn once
        expect(flow.nodes.filter((n) => n.data.calmId === 'ns')).toHaveLength(1);
        expect(Object.keys(saved.metadata._layout).every((id) => flow.nodes.some((n) => n.id === id))).toBe(true);
    });

    it('keeps a nested node that is also in a container that stays', () => {
        open({
            nodes: [node('X'), node('Y'), node('s')],
            relationships: [deployedIn('r1', 'Y', ['s']), deployedIn('r2', 'X', ['Y', 's'])],
        });
        deleteDrawings(['Y']);

        const [saved] = saves();
        expect(saved.nodes.map((n: { 'unique-id': string }) => n['unique-id'])).toEqual(['X', 's']);
        expect(containment(saved)).toEqual([['r2', ['s']]]);
        expect(flow.nodes.find((n) => n.id === 's')?.parentId).toBe('X');
    });

    it('saves once when a deleted drawing has edges', () => {
        open(sharedNamespace);
        // svc and its edge c1 go with the ns drawing that keeps the CALM id
        deleteDrawings(['ns']);

        expect(saves()).toHaveLength(1);
        expect(saves()[0].relationships.map((r: { 'unique-id': string }) => r['unique-id'])).toContain('c1');
    });

    it('removes a membership from every drawing when a copy leaves its container', () => {
        open(sharedNamespace);
        const copy = flow.nodes.find((n) => n.id !== 'svc' && n.data.calmId === 'svc')!;
        act(() => flow.onNodeClick({}, copy));
        const button = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Remove from Container')!;
        act(() => button.click());
        act(() => vi.runAllTimers());

        const saved = lastSave();
        expect(saved.nodes.map((n: { 'unique-id': string }) => n['unique-id'])).toContain('svc');
        expect(containment(saved)).toContainEqual(['r3', []]);
        expect(flow.nodes.filter((n) => n.data.calmId === 'svc')).toHaveLength(1);
    });

    it('renames every drawing when a copy is renamed', () => {
        open(sharedNamespace);
        const copy = flow.nodes.find((n) => n.id !== 'svc' && n.data.calmId === 'svc')!;
        act(() => flow.onNodeClick({}, copy));
        const input = [...document.querySelectorAll('input')].find((i) => i.value === 'svc')!;
        act(() => {
            input.value = 'renamed';
            input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        });
        act(() => vi.runAllTimers());

        expect(flow.nodes.filter((n) => n.data.calmId === 'svc').map((n) => n.data.label)).toEqual(['renamed', 'renamed']);
        expect(lastSave().nodes.find((n: { 'unique-id': string }) => n['unique-id'] === 'svc').name).toBe('renamed');
    });

    it('links a standard dropped on a copy and on the original to the node once', () => {
        open(sharedNamespace);
        act(() => window.dispatchEvent(new MessageEvent('message', {
            data: { type: 'standardNodesLoaded', nodes: [{ id: 'std', name: 'Standard', controls: { 'rate-limit': { description: 'Limit', requirements: [] } } }] },
        })));
        const copy = flow.nodes.find((n) => n.id !== 'svc' && n.data.calmId === 'svc')!;
        // The drop finds the drawing under the pointer in the page: first the copy, then the original
        const under = [copy.id, 'svc'];
        document.elementsFromPoint = () => [{ closest: () => ({ getAttribute: () => under.shift() }) } as unknown as Element];
        const data: Record<string, string> = {
            'application/standard-node-id': 'std',
            'application/standard-node-behaviour': 'apply-controls-on-drop',
        };
        const drop = { preventDefault: () => undefined, stopPropagation: () => undefined, clientX: 0, clientY: 0, dataTransfer: { getData: (k: string) => data[k] ?? '' } };
        for (let i = 0; i < 2; i++) {
            act(() => flow.onDrop(drop));
            act(() => vi.runAllTimers());
        }

        const links = lastSave().relationships.filter((r: Record<string, any>) => r['relationship-type'].connects?.source.node === 'svc');
        expect(links).toHaveLength(1);
    });

    it('resolves a definition once per node and applies it to every drawing', () => {
        const withDefinition = {
            ...sharedNamespace,
            nodes: sharedNamespace.nodes.map((n) => (n['unique-id'] === 'svc' ? { ...n, 'definition-id': 'finos:standard-nodes:svc@1' } : n)),
        };
        open(withDefinition);
        expect(posted.filter((m) => m.type === 'resolveDefinitionId')).toHaveLength(0);
        // open() clears what the load posted, so load again
        act(() => root.unmount());
        posted.length = 0;
        (window as unknown as { __INITIAL_CALM_JSON__?: string }).__INITIAL_CALM_JSON__ = JSON.stringify(withDefinition);
        const el = document.createElement('div');
        document.body.appendChild(el);
        act(() => {
            root = createRoot(el);
            root.render(<App />);
        });
        expect(posted.filter((m) => m.type === 'resolveDefinitionId')).toHaveLength(1);

        const controls = { 'rate-limit': { description: 'Limit', requirements: [{ 'requirement-url': 'x' }] } };
        act(() => window.dispatchEvent(new MessageEvent('message', { data: { type: 'definitionResolved', nodeId: 'svc', controls } })));
        expect(flow.nodes.filter((n) => n.data.calmId === 'svc').map((n) => n.data.controls)).toEqual([controls, controls]);
    });

    it('saves once without a rebuild when no node has several drawings', () => {
        open({ nodes: [node('a'), node('b'), node('c')], relationships: [deployedIn('r1', 'a', ['b', 'c'])] });
        deleteDrawings(['b']);

        expect(saves()).toHaveLength(2);
    });
});
