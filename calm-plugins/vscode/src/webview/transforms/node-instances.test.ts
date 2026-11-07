import { describe, it, expect } from 'vitest';
import type { Node, Edge } from 'reactflow';
import { updateInstances, reattachEdges, sameMembership, withDescendants, hasSharedDrawings, planDelete } from './node-instances';

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

describe('sameMembership', () => {
    // ns is in cluster-a and cluster-b, svc is in ns, so svc has one membership and two drawings
    const nodes = [
        flowNode('cluster-a'), flowNode('cluster-b'),
        flowNode('ns', 'ns', 'cluster-a'), flowNode('ns__in__cluster-b', 'ns', 'cluster-b'),
        flowNode('svc', 'svc', 'ns'), flowNode('svc__in__ns__in__cluster-b', 'svc', 'ns__in__cluster-b'),
    ];

    it('finds the other drawings of the same node in the same container', () => {
        expect(sameMembership(nodes[5], nodes).map((n) => n.id)).toEqual(['svc']);
    });

    it('finds none for a drawing of a different membership', () => {
        expect(sameMembership(nodes[3], nodes)).toEqual([]);
    });

    it('finds none for a top-level drawing', () => {
        expect(sameMembership(nodes[0], nodes)).toEqual([]);
    });
});

describe('withDescendants', () => {
    it('adds every drawing nested in the given drawings', () => {
        const nodes = [flowNode('a'), flowNode('b', 'b', 'a'), flowNode('c', 'c', 'b'), flowNode('d')];
        expect([...withDescendants(new Set(['a']), nodes)].sort()).toEqual(['a', 'b', 'c']);
    });
});

describe('hasSharedDrawings', () => {
    it('is true when a node has several drawings or a membership that is not drawn', () => {
        expect(hasSharedDrawings([flowNode('ns', 'ns', 'a'), flowNode('ns__in__b', 'ns', 'b')])).toBe(true);
        expect(hasSharedDrawings([{ ...flowNode('svc', 'svc', 'ns'), data: { calmId: 'svc', otherParents: ['cluster'] } }])).toBe(true);
    });

    it('is false when each node has one drawing and every membership is drawn', () => {
        expect(hasSharedDrawings([flowNode('a'), flowNode('b', 'b', 'a')])).toBe(false);
    });
});

describe('planDelete', () => {
    const withOtherParents = (n: Node, otherParents: string[]): Node => ({ ...n, data: { ...n.data, otherParents } });

    it('deletes the drawings nested in a deleted drawing, but not the other drawings of them', () => {
        // ns is in cluster-a and cluster-b, svc is in ns. React Flow passes svc's drawing along with ns.
        const nodes = [
            flowNode('cluster-a'), flowNode('cluster-b'),
            flowNode('ns', 'ns', 'cluster-a'), flowNode('ns__in__cluster-b', 'ns', 'cluster-b'),
            flowNode('svc', 'svc', 'ns'), flowNode('svc__in__ns__in__cluster-b', 'svc', 'ns__in__cluster-b'),
        ];
        const { deletedIds } = planDelete([nodes[3], nodes[5]], nodes);
        expect([...deletedIds].sort()).toEqual(['ns__in__cluster-b', 'svc__in__ns__in__cluster-b']);
    });

    it('also deletes the drawings of the same membership as a picked drawing', () => {
        const nodes = [
            flowNode('ns', 'ns', 'cluster'), flowNode('ns__in__cluster-b', 'ns', 'cluster-b'),
            flowNode('svc', 'svc', 'ns'), flowNode('svc__in__ns__in__cluster-b', 'svc', 'ns__in__cluster-b'),
        ];
        const { deletedIds } = planDelete([nodes[2]], nodes);
        expect([...deletedIds].sort()).toEqual(['svc', 'svc__in__ns__in__cluster-b']);
    });

    it('keeps a nested node that is also in a container that stays, at the top level', () => {
        // s is in Y and in X, Y is in X. s is drawn in Y only. Deleting Y keeps s in X.
        const nodes = [flowNode('X'), flowNode('Y', 'Y', 'X'), withOtherParents(flowNode('s', 's', 'Y'), ['X'])];
        const { deletedIds, keptRoots } = planDelete([nodes[1], nodes[2]], nodes);
        expect([...deletedIds]).toEqual(['Y']);
        expect(keptRoots.map((n) => [n.id, n.parentId])).toEqual([['s', undefined]]);
    });
});
