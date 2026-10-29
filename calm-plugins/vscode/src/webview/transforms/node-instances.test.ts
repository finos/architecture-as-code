import { describe, it, expect } from 'vitest';
import type { Node, Edge } from 'reactflow';
import { updateInstances, reattachEdges } from './node-instances';

const flowNode = (id: string, calmId = id, parentId?: string): Node => ({
    id,
    position: { x: 0, y: 0 },
    data: { calmId, label: calmId },
    ...(parentId ? { parentId } : {}),
});
const edge = (id: string, source: string, target: string): Edge => ({ id, source, target });

describe('updateInstances', () => {
    const nodes = [flowNode('ns', 'ns', 'cluster-a'), flowNode('ns__in__cluster-b', 'ns', 'cluster-b'), flowNode('svc')];
    const rename = (n: Node) => ({ ...n, data: { ...n.data, label: 'renamed' } });

    it('updates every drawing of the node', () => {
        const result = updateInstances(nodes, 'ns__in__cluster-b', rename);
        expect(result.map((n) => n.data.label)).toEqual(['renamed', 'renamed', 'svc']);
    });

    it('keeps the position and parent of each drawing', () => {
        const result = updateInstances(nodes, 'ns', rename);
        expect(result.map((n) => n.parentId)).toEqual(['cluster-a', 'cluster-b', undefined]);
    });

    it('returns the nodes unchanged for an unknown id', () => {
        expect(updateInstances(nodes, 'missing', rename)).toEqual(nodes);
    });
});

describe('reattachEdges', () => {
    it('moves edges of a deleted drawing to a remaining drawing of the same node', () => {
        const deleted = [flowNode('ns', 'ns', 'cluster-a')];
        const remaining = [flowNode('ns__in__cluster-b', 'ns', 'cluster-b'), flowNode('client')];
        const result = reattachEdges([edge('c1', 'client', 'ns'), edge('c2', 'ns', 'client')], deleted, remaining);
        expect(result.map((e) => [e.id, e.source, e.target])).toEqual([
            ['c1', 'client', 'ns__in__cluster-b'],
            ['c2', 'ns__in__cluster-b', 'client'],
        ]);
    });

    it('removes edges of a node with no remaining drawing', () => {
        const deleted = [flowNode('ns')];
        const remaining = [flowNode('client')];
        const result = reattachEdges([edge('c1', 'client', 'ns'), edge('c2', 'client', 'client')], deleted, remaining);
        expect(result.map((e) => e.id)).toEqual(['c2']);
    });
});
