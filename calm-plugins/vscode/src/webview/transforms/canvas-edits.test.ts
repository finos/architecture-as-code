import { describe, it, expect, beforeEach } from 'vitest';
import type { Node } from 'reactflow';
import { parseCALMData } from './calm-parser';
import { flowToCalm, setLastParsedArch, type CalmArchitecture } from './calm-editor-transformer';
import { deleteDrawings, unparentDrawing, linkTargetOf, withIssueCounts, pastedNode, originalsOf } from './canvas-edits';

const node = (id: string) => ({ 'unique-id': id, 'node-type': 'system', name: id, description: id });
const deployedIn = (id: string, container: string, nodes: string[]) =>
    ({ 'unique-id': id, 'relationship-type': { 'deployed-in': { container, nodes } } });
const connects = (id: string, source: string, destination: string) =>
    ({ 'unique-id': id, 'relationship-type': { connects: { source: { node: source }, destination: { node: destination } } } });

// The canvas as App loads it: parse the file and remember it for the save
const load = (arch: CalmArchitecture) => {
    setLastParsedArch(arch);
    return parseCALMData(arch);
};
const containment = (out: CalmArchitecture) =>
    out.relationships
        .filter((r) => (r['relationship-type'] as Record<string, unknown>)['deployed-in'])
        .map((r) => [r['unique-id'], (r['relationship-type'] as any)['deployed-in'].nodes]);
const nodeIds = (out: CalmArchitecture) => out.nodes.map((n) => n['unique-id']);
const relIds = (out: CalmArchitecture) => out.relationships.map((r) => r['unique-id']);
const byId = (nodes: Node[], id: string) => nodes.find((n) => n.id === id)!;
// React Flow passes the picked drawings and every drawing nested in them
const withNested = (picked: Node[], nodes: Node[]) => {
    const ids = new Set(picked.map((n) => n.id));
    for (let grew = true; grew;) {
        grew = false;
        for (const n of nodes) if (n.parentId && ids.has(n.parentId) && !ids.has(n.id)) { ids.add(n.id); grew = true; }
    }
    return nodes.filter((n) => ids.has(n.id));
};

const sharedNamespace = (): CalmArchitecture => ({
    nodes: [node('cluster-a'), node('cluster-b'), node('ns'), node('svc'), node('client')],
    relationships: [
        deployedIn('r1', 'cluster-a', ['ns']),
        deployedIn('r2', 'cluster-b', ['ns']),
        deployedIn('r3', 'ns', ['svc']),
        connects('c1', 'client', 'svc'),
    ],
});

beforeEach(() => setLastParsedArch(null));

describe('deleteDrawings', () => {
    it('keeps the nodes inside the other drawings of a deleted container', () => {
        const { nodes, edges } = load(sharedNamespace());
        const copy = nodes.find((n) => n.id !== 'ns' && n.data.calmId === 'ns')!;
        const edit = deleteDrawings(nodes, edges, withNested([copy], nodes));
        const out = flowToCalm(edit.nodes, edit.edges);
        expect(nodeIds(out)).toEqual(['cluster-a', 'cluster-b', 'ns', 'svc', 'client']);
        expect(containment(out)).toContainEqual(['r3', ['svc']]);
        expect(relIds(out)).toContain('c1');
        expect(edit.reload).toBe(true);
    });

    it('removes a membership from every drawing of it', () => {
        const { nodes, edges } = load(sharedNamespace());
        const edit = deleteDrawings(nodes, edges, [byId(nodes, 'svc')]);
        const out = flowToCalm(edit.nodes, edit.edges);
        expect(nodeIds(out)).not.toContain('svc');
        expect(edit.nodes.some((n) => n.data.calmId === 'svc')).toBe(false);
    });

    it('moves the edges of a deleted drawing to a drawing that remains', () => {
        const arch: CalmArchitecture = {
            nodes: [node('a'), node('b'), node('n'), node('client')],
            relationships: [deployedIn('r1', 'a', ['n']), deployedIn('r2', 'b', ['n']), connects('c1', 'client', 'n')],
        };
        const { nodes, edges } = load(arch);
        // The edge is on the drawing that keeps the CALM id, in b
        const edit = deleteDrawings(nodes, edges, [byId(nodes, 'n')]);
        const out = flowToCalm(edit.nodes, edit.edges);
        // b is still drawn, so it keeps its relationship, empty, as on main
        expect(containment(out)).toEqual([['r1', ['n']], ['r2', []]]);
        expect(relIds(out)).toContain('c1');
    });

    it('keeps a nested node that is also in a container that stays', () => {
        // s is in Y and in X, and Y is in X, so s is drawn in Y only
        const arch: CalmArchitecture = {
            nodes: [node('X'), node('Y'), node('s')],
            relationships: [deployedIn('r1', 'Y', ['s']), deployedIn('r2', 'X', ['Y', 's'])],
        };
        const { nodes, edges } = load(arch);
        const edit = deleteDrawings(nodes, edges, withNested([byId(nodes, 'Y')], nodes));
        const out = flowToCalm(edit.nodes, edit.edges);
        expect(nodeIds(out)).toEqual(['X', 's']);
        expect(containment(out)).toEqual([['r2', ['s']]]);
        // At the top level until the reload, where it was on the canvas
        const [x, y, s] = ['X', 'Y', 's'].map((id) => byId(nodes, id).position);
        expect(byId(edit.nodes, 's').position).toEqual({ x: x.x + y.x + s.x, y: x.y + y.y + s.y });
    });

    it('does not ask for a reload when no node has several drawings', () => {
        const { nodes, edges } = load({ nodes: [node('a'), node('b')], relationships: [deployedIn('r1', 'a', ['b'])] });
        expect(deleteDrawings(nodes, edges, [byId(nodes, 'b')]).reload).toBe(false);
    });
});

describe('unparentDrawing', () => {
    it('removes the membership from every drawing of it and keeps the node', () => {
        const { nodes, edges } = load(sharedNamespace());
        const copy = nodes.find((n) => n.id !== 'svc' && n.data.calmId === 'svc')!;
        const edit = unparentDrawing(nodes, edges, copy.id);
        const out = flowToCalm(edit.nodes, edit.edges);
        expect(nodeIds(out)).toContain('svc');
        expect(containment(out)).toEqual([['r1', ['ns']], ['r2', ['ns']], ['r3', []]]);
        expect(relIds(out)).toContain('c1');
        expect(edit.reload).toBe(true);
    });

    it('moves a node out of its only container', () => {
        const { nodes, edges } = load({ nodes: [node('a'), node('b')], relationships: [deployedIn('r1', 'a', ['b'])] });
        const edit = unparentDrawing(nodes, edges, 'b');
        expect(byId(edit.nodes, 'b').parentId).toBeUndefined();
        expect(edit.reload).toBe(false);
    });
});

describe('linkTargetOf', () => {
    it('gives the drawing that keeps the CALM id, where the edges are', () => {
        const { nodes } = load(sharedNamespace());
        const copy = nodes.find((n) => n.id !== 'svc' && n.data.calmId === 'svc')!;
        expect(linkTargetOf(nodes, copy.id)).toBe('svc');
        expect(linkTargetOf(nodes, 'unknown')).toBe('unknown');
    });
});

describe('withIssueCounts', () => {
    it('shows the counts of a node on every drawing of it', () => {
        const { nodes } = load(sharedNamespace());
        const counted = withIssueCounts(nodes, [
            { severity: 'error', message: 'x', nodeId: 'svc' },
            { severity: 'warning', message: 'y', nodeId: 'svc' },
            { severity: 'info', message: 'z' },
        ]);
        const svc = counted.filter((n) => n.data.calmId === 'svc');
        expect(svc).toHaveLength(2);
        expect(svc.map((n) => [n.data.validationErrors, n.data.validationWarnings])).toEqual([[1, 1], [1, 1]]);
        expect(byId(counted, 'client').data.validationErrors).toBe(0);
    });
});

describe('pastedNode', () => {
    it('makes an independent node with no memberships', () => {
        const { nodes } = load(sharedNamespace());
        const src = { ...byId(nodes, 'svc'), data: { ...byId(nodes, 'svc').data, otherParents: ['x'], 'definition-id': 'd' } };
        const pasted = pastedNode(src, 'svc-2');
        expect(pasted.id).toBe('svc-2');
        expect(pasted.parentId).toBeUndefined();
        expect(pasted.data).toEqual(expect.objectContaining({ calmId: 'svc-2', label: 'svc (copy)' }));
        expect(pasted.data.otherParents).toBeUndefined();
        expect(pasted.data['definition-id']).toBeUndefined();
    });
});

describe('originalsOf', () => {
    it('gives each CALM node once, by the drawing that keeps its id', () => {
        const { nodes } = load(sharedNamespace());
        expect(originalsOf(nodes).map((n) => n.id).sort()).toEqual(['client', 'cluster-a', 'cluster-b', 'ns', 'svc']);
    });
});
