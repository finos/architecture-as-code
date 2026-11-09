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
    onNodeDragStop: (event: unknown, node: Node) => void;
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
// ReactFlow deletes the picked drawings and those nested in them. It calls onEdgesChange for the picked
// edges and the edges of those drawings, then onNodesDelete, then onNodesChange.
const deleteDrawings = (picked: string[], pickedEdges: string[] = []) => {
    const ids = new Set(picked);
    for (let grew = true; grew;) {
        grew = false;
        for (const n of flow.nodes) if (n.parentId && ids.has(n.parentId) && !ids.has(n.id)) { ids.add(n.id); grew = true; }
    }
    const deleted = flow.nodes.filter((n) => ids.has(n.id));
    const deletedEdges = flow.edges.filter((e) => pickedEdges.includes(e.id) || ids.has(e.source) || ids.has(e.target));
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

    it('keeps an edge deleted with a node deleted', () => {
        const withEdge = (arch: typeof sharedNamespace) => ({ nodes: [...arch.nodes, node('x'), node('y')], relationships: [...arch.relationships, connects('c2', 'x', 'y')] });
        // Without copies the delete saves at once; with copies it rebuilds the canvas
        const cases: [typeof sharedNamespace, string][] = [
            [{ nodes: [node('a'), node('b')], relationships: [connects('c1', 'a', 'b')] }, 'a'],
            [sharedNamespace, 'ns__in__cluster-a'],
        ];
        cases.forEach(([arch, picked], i) => {
            if (i > 0) act(() => root.unmount());
            open(withEdge(arch));
            deleteDrawings([picked], ['c2']);

            expect(flow.edges.map((e) => e.id), picked).not.toContain('c2');
            expect(lastSave().relationships.map((r: { 'unique-id': string }) => r['unique-id']), picked).not.toContain('c2');
        });
    });

    it('moves a selected edge of a deleted drawing to another drawing, as a box selection selects it', () => {
        open({
            nodes: [node('A'), node('B'), node('X'), node('client')],
            relationships: [deployedIn('r1', 'A', ['X']), deployedIn('r2', 'B', ['X']), connects('c1', 'client', 'X')],
        });
        act(() => flow.onEdgesChange([{ id: 'c1', type: 'select', selected: true }]));
        deleteDrawings(['X'], ['c1']);

        expect(lastSave().relationships.map((r: { 'unique-id': string }) => r['unique-id'])).toContain('c1');
        expect(flow.edges.map((e) => [e.source, e.target])).toEqual([['client', 'X']]);
    });

    it('keeps the edges of a nested node that the delete keeps in another container', () => {
        open({
            nodes: [node('X'), node('Y'), node('s'), node('z')],
            relationships: [deployedIn('r1', 'Y', ['s']), deployedIn('r2', 'X', ['Y', 's']), connects('c1', 's', 'z')],
        });
        // A box around Y also selects s and its edge
        act(() => flow.onEdgesChange([{ id: 'c1', type: 'select', selected: true }]));
        deleteDrawings(['Y'], ['c1']);

        expect(lastSave().relationships.map((r: { 'unique-id': string }) => r['unique-id'])).toContain('c1');
        expect(flow.edges.map((e) => [e.source, e.target])).toEqual([['s', 'z']]);
    });

    it('clears the selection when the selected drawing is deleted', () => {
        open(sharedNamespace);
        const copy = flow.nodes.find((n) => n.id !== 'ns' && n.data.calmId === 'ns')!;
        act(() => flow.onNodeClick({}, copy));
        deleteDrawings([copy.id]);
        const saved = saves().length;

        expect([...document.querySelectorAll('button')].some((b) => b.textContent === 'Remove from Container')).toBe(false);
        act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'u', ctrlKey: true, shiftKey: true })));
        act(() => vi.runAllTimers());
        expect(saves()).toHaveLength(saved);
    });

    it('keeps the selection when the delete keeps the selected node in another container', () => {
        open({
            nodes: [node('X'), node('Y'), node('s'), node('z')],
            relationships: [deployedIn('r1', 'Y', ['s']), deployedIn('r2', 'X', ['Y', 's']), connects('c1', 's', 'z')],
        });
        act(() => flow.onNodeClick({}, flow.nodes.find((n) => n.id === 's')!));
        deleteDrawings(['Y']);

        expect([...document.querySelectorAll('input')].some((i) => i.value === 's')).toBe(true);
    });

    it('clears the selection when the delete removes the selected drawing with another one', () => {
        // N is drawn in both drawings of C. Deleting one removes N from C, so both go.
        open({
            nodes: [node('P1'), node('P2'), node('C'), node('D'), node('N')],
            relationships: [deployedIn('r1', 'P1', ['C']), deployedIn('r2', 'P2', ['C']), deployedIn('r3', 'C', ['N']), deployedIn('r4', 'D', ['N'])],
        });
        const inC = flow.nodes.filter((n) => n.data.calmId === 'N' && flow.nodes.find((m) => m.id === n.parentId)?.data.calmId === 'C');
        act(() => flow.onNodeClick({}, inC[1]));
        deleteDrawings([inC[0].id]);

        expect([...document.querySelectorAll('input')].some((i) => i.value === 'N')).toBe(false);
    });

    it('keeps the selection on the same drawing when a rebuild renames it', () => {
        const removeFromContainer = () => {
            act(() => [...document.querySelectorAll('button')].find((b) => b.textContent === 'Remove from Container')!.click());
            act(() => vi.runAllTimers());
        };
        const r = (id: string) => lastSave().relationships.find((x: { 'unique-id': string }) => x['unique-id'] === id)['relationship-type']['deployed-in'].nodes;
        open({
            nodes: [node('P1'), node('P2'), node('C'), node('D'), node('N'), node('z')],
            relationships: [deployedIn('r1', 'P1', ['C']), deployedIn('r2', 'P2', ['C']), deployedIn('r3', 'C', ['N']), deployedIn('r4', 'D', ['N'])],
        });
        // N in C in P1. The rebuild after P2 goes draws C only in P1, and renames this drawing.
        act(() => flow.onNodeClick({}, flow.nodes.find((n) => n.data.calmId === 'N' && n.parentId === 'C__in__P1')!));
        deleteDrawings(['P2']);
        deleteDrawings(['z']);

        removeFromContainer();
        expect([r('r3'), r('r4')]).toEqual([[], ['N']]);
    });

    it('removes the shown drawing from its container with the shortcut after a rebuild', () => {
        open({
            nodes: [node('cluster-a'), node('cluster-b'), node('cluster-c'), node('ns')],
            relationships: [deployedIn('r1', 'cluster-a', ['ns']), deployedIn('r2', 'cluster-b', ['ns']), deployedIn('r3', 'cluster-c', ['ns'])],
        });
        const copy = flow.nodes.find((n) => n.id !== 'ns' && n.data.calmId === 'ns')!;
        act(() => flow.onNodeClick({}, copy));
        const unparent = () => {
            act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'u', ctrlKey: true, shiftKey: true })));
            act(() => vi.runAllTimers());
        };
        unparent();
        expect(flow.nodes.filter((n) => n.data.calmId === 'ns')).toHaveLength(2);

        unparent();
        expect(flow.nodes.filter((n) => n.data.calmId === 'ns')).toHaveLength(1);
    });

    it('puts a node dropped in a nested container into the innermost one', () => {
        open({ nodes: [node('C'), node('N'), node('S'), node('Y')], relationships: [deployedIn('r1', 'C', ['N']), deployedIn('r2', 'N', ['S'])] });
        const byId = new Map(flow.nodes.map((n) => [n.id, n]));
        const n = byId.get('N')!;
        const at = { x: byId.get('C')!.position.x + n.position.x + 5, y: byId.get('C')!.position.y + n.position.y + 5 };

        act(() => flow.onNodeDragStop({}, { ...byId.get('Y')!, position: at }));
        act(() => vi.runAllTimers());

        expect(flow.nodes.find((m) => m.id === 'Y')!.parentId).toBe('N');
        expect(lastSave().relationships.find((r: Record<string, any>) => r['relationship-type']['deployed-in']?.nodes.includes('Y'))['relationship-type']['deployed-in'].container).toBe('N');
    });

    it('edits the node that stays after a copy leaves its container', () => {
        open(sharedNamespace);
        const copy = flow.nodes.find((n) => n.id !== 'ns' && n.data.calmId === 'ns')!;
        act(() => flow.onNodeClick({}, copy));
        const button = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Remove from Container')!;
        act(() => button.click());
        act(() => vi.runAllTimers());
        expect(flow.nodes.some((n) => n.id === copy.id)).toBe(false);

        const input = [...document.querySelectorAll('input')].find((i) => i.value === 'ns')!;
        act(() => {
            input.value = 'renamed';
            input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        });
        act(() => vi.runAllTimers());

        expect(lastSave().nodes.find((n: { 'unique-id': string }) => n['unique-id'] === 'ns').name).toBe('renamed');
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

    it('adds the controls of a standard dropped on a copy or the original to every drawing and saves them once', () => {
        open(sharedNamespace);
        act(() => window.dispatchEvent(new MessageEvent('message', {
            data: { type: 'standardNodesLoaded', nodes: [{ id: 'std', name: 'Standard', controls: { 'rate-limit': { description: 'Limit', requirements: [] } } }] },
        })));
        const copy = flow.nodes.find((n) => n.id !== 'svc' && n.data.calmId === 'svc')!;
        document.elementsFromPoint = () => [{ closest: () => ({ getAttribute: () => copy.id }) } as unknown as Element];
        const data: Record<string, string> = {
            'application/standard-node-id': 'std',
            'application/standard-node-behaviour': 'apply-controls-on-drop',
        };
        const drop = { preventDefault: () => undefined, stopPropagation: () => undefined, clientX: 0, clientY: 0, dataTransfer: { getData: (k: string) => data[k] ?? '' } };
        act(() => flow.onDrop(drop));
        act(() => vi.runAllTimers());
        document.elementsFromPoint = () => [{ closest: () => ({ getAttribute: () => 'svc' }) } as unknown as Element];
        act(() => flow.onDrop(drop));
        act(() => vi.runAllTimers());

        expect(flow.nodes.filter((n) => n.data.calmId === 'svc').map((n) => Object.keys(n.data.controls ?? {}))).toEqual([['rate-limit'], ['rate-limit']]);
        const saved = lastSave();
        expect(saved.nodes.filter((n: { 'unique-id': string }) => n['unique-id'] === 'svc')).toHaveLength(1);
        expect(Object.keys(saved.nodes.find((n: { 'unique-id': string }) => n['unique-id'] === 'svc').controls)).toEqual(['rate-limit']);
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

    it('says so when the diagram is too large to draw a node in each of its containers', () => {
        const notice = () => document.querySelector('[role="status"]')?.textContent;
        open(sharedNamespace);
        expect(notice()).toBeUndefined();
        act(() => root.unmount());

        // Each level has two containers that are both in both containers of the level above
        const ids = Array.from({ length: 12 }, (_, k) => [`l${k}a`, `l${k}b`]);
        open({
            nodes: ids.flat().map(node),
            relationships: ids.slice(1).flatMap(([a, b], k) => [deployedIn(`r${k}a`, ids[k][0], [a, b]), deployedIn(`r${k}b`, ids[k][1], [a, b])]),
        });
        expect(notice()).toBe('This diagram is too large to draw a node in each of its containers. Each node is drawn in one container only.');

        act(() => window.dispatchEvent(new MessageEvent('message', { data: { type: 'modelUpdated', json: '', source: 'text-editor' } })));
        expect(notice()).toBeUndefined();
    });

    it('rebuilds the canvas, with the notice, when a drag into a container passes the copy limit', () => {
        // C is drawn in each of 20 containers, with 51 children: 988 copies, under the limit
        const P = Array.from({ length: 20 }, (_, i) => `P${i}`);
        const leaves = Array.from({ length: 51 }, (_, i) => `leaf${i}`);
        open({
            nodes: [...P, 'C', ...leaves, 'Y'].map(node),
            relationships: [...P.map((p, i) => deployedIn(`rp${i}`, p, ['C'])), deployedIn('rc', 'C', leaves)],
        });
        expect(document.querySelector('[role="status"]')).toBeNull();
        const byId = new Map(flow.nodes.map((n) => [n.id, n]));
        const abs = (n: Node): { x: number; y: number } => {
            const p = n.parentId ? abs(byId.get(n.parentId)!) : { x: 0, y: 0 };
            return { x: p.x + n.position.x, y: p.y + n.position.y };
        };
        // A point in C that is outside the container C is drawn in, so the drop picks C
        const c = byId.get('C')!;
        const p = byId.get(c.parentId!)!;
        const at = { x: abs(p).x + p.width! + 5, y: abs(c).y + 5 };
        expect(at.x).toBeLessThan(abs(c).x + c.width!);

        act(() => flow.onNodeDragStop({}, { ...byId.get('Y')!, position: at }));
        act(() => vi.runAllTimers());

        // Y makes 20 more copies: past the limit, each node is drawn once
        expect(flow.nodes.filter((n) => n.data.calmId === 'C')).toHaveLength(1);
        expect(document.querySelector('[role="status"]')).not.toBeNull();
    });

    it('saves without a rebuild when no node has several drawings', () => {
        open({ nodes: [node('a'), node('b'), node('c')], relationships: [deployedIn('r1', 'a', ['b', 'c'])] });
        deleteDrawings(['b']);

        expect(saves()).toHaveLength(2);
    });
});
