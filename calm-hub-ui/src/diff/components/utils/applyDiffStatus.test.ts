import { describe, expect, it } from 'vitest';
import type { Node, Edge } from 'reactflow';
import type { DiffResult } from '@finos/calm-models/diff';
import { applyDiffStatus } from './applyDiffStatus.js';

const emptyDiff: DiffResult = {
    nodesAdded: [],
    nodesRemoved: [],
    nodesModified: [],
    nodesRenamed: [],
    nodesSame: [],
    edgesAdded: [],
    edgesRemoved: [],
    edgesModified: [],
    edgesRenamed: [],
    edgesSame: [],
};

const node = (id: string | undefined, data: Record<string, unknown>): Node =>
    ({ id: id ?? 'idless', position: { x: 0, y: 0 }, data } as Node);

describe('applyDiffStatus', () => {
    it('highlights an added node matched by unique-id', () => {
        const parsed = { nodes: [node('svc-a', { 'unique-id': 'svc-a' })], edges: [] as Edge[] };
        const diff: DiffResult = {
            ...emptyDiff,
            nodesAdded: [{ 'unique-id': 'svc-a', name: 'A', 'node-type': 'service' }],
        };
        const result = applyDiffStatus(parsed, diff, false);
        expect(result.nodes[0].data.diffStatus).toBe('added');
    });

    it('leaves id-less pattern nodes unchanged rather than matching by undefined', () => {
        // An unconstrained pattern node has no unique-id; the diff's id-less
        // content entry also has none. Without the guard, `undefined === undefined`
        // would mark every id-less node 'added'.
        const parsed = {
            nodes: [
                node('api-gateway', { 'unique-id': 'api-gateway' }),
                node(undefined, { name: 'Worker', 'node-type': 'service' }),
            ],
            edges: [] as Edge[],
        };
        const diff: DiffResult = {
            ...emptyDiff,
            nodesAdded: [{ name: 'Worker', 'node-type': 'service' } as never],
        };

        const result = applyDiffStatus(parsed, diff, false);

        expect(result.nodes.map((n) => n.data.diffStatus)).toEqual(['unchanged', 'unchanged']);
    });
});
