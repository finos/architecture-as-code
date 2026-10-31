// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Node, Edge, NodeChange } from 'reactflow';

// The canvas is drawn by ReactFlow, which needs a real layout. Capture its props instead,
// and play the callbacks in the order ReactFlow calls them.
type FlowProps = { nodes: Node[]; edges: Edge[]; onNodesDelete: (nodes: Node[]) => void; onNodesChange: (changes: NodeChange[]) => void };
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
// ReactFlow removes the picked drawings and those nested in them, then calls onNodesDelete, then onNodesChange
const deleteDrawings = (picked: string[]) => {
    const ids = new Set(picked);
    for (let grew = true; grew;) {
        grew = false;
        for (const n of flow.nodes) if (n.parentId && ids.has(n.parentId) && !ids.has(n.id)) { ids.add(n.id); grew = true; }
    }
    const deleted = flow.nodes.filter((n) => ids.has(n.id));
    act(() => {
        flow.onNodesDelete(deleted);
        flow.onNodesChange(deleted.map((n) => ({ id: n.id, type: 'remove' })));
    });
    // Both queued saves run before React draws again
    act(() => vi.runAllTimers());
};
const saves = () => posted.filter((m) => m.type === 'canvasChanged').map((m) => JSON.parse(m.json!));
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

describe('App: delete on a canvas with copies', () => {
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

    it('saves once without a rebuild when no node has several drawings', () => {
        open({ nodes: [node('a'), node('b'), node('c')], relationships: [deployedIn('r1', 'a', ['b', 'c'])] });
        deleteDrawings(['b']);

        expect(saves()).toHaveLength(2);
    });
});
