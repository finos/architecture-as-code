import { describe, it, expect, beforeEach } from 'vitest';
import type { Node } from 'reactflow';
import {
    applyPositions,
    applyStoredPositions,
    buildViewportKey,
    clearStoredNodePositions,
    loadStoredNodePositions,
    saveNodePositions,
    StoredNodePosition,
    toStoredPositions,
} from './node-position-service.js';
import { createMemoryStorage } from '../../test-support/memory-storage.js';
import { GRAPH_LAYOUT } from '../components/reactflow/utils/constants.js';

const STORAGE_PREFIX = 'calm-hub:node-positions:';
const key = 'finos/conference-signup';

const nodes: Node[] = [
    { id: 'node-1', position: { x: 100, y: 200 }, data: {} },
    { id: 'node-2', position: { x: 300, y: 400 }, data: {} },
];

const storedPositions: StoredNodePosition[] = [
    { id: 'node-1', position: { x: 100, y: 200 } },
    { id: 'node-2', position: { x: 300, y: 400 } },
];

describe('node-position-service', () => {
    let storage: Storage;
    beforeEach(() => {
        storage = createMemoryStorage();
    });

    describe('saveNodePositions', () => {
        it('stores positions under a namespaced key', () => {
            saveNodePositions(key, nodes, storage);
            expect(storage.getItem(`${STORAGE_PREFIX}${key}`)).not.toBeNull();
        });

        it('serialises only id and position from each node', () => {
            saveNodePositions(key, nodes, storage);
            const stored = storage.getItem(`${STORAGE_PREFIX}${key}`);
            expect(JSON.parse(stored!)).toEqual(storedPositions);
        });

        it('keys distinct diagrams separately, avoiding title collisions', () => {
            saveNodePositions('a/1', [{ id: 'n', position: { x: 1, y: 2 }, data: {} }], storage);
            saveNodePositions('b/1', [{ id: 'n', position: { x: 9, y: 9 }, data: {} }], storage);
            expect(loadStoredNodePositions('a/1', storage)).toEqual([{ id: 'n', position: { x: 1, y: 2 } }]);
            expect(loadStoredNodePositions('b/1', storage)).toEqual([{ id: 'n', position: { x: 9, y: 9 } }]);
        });
    });

    describe('loadStoredNodePositions', () => {
        it('loads previously saved positions', () => {
            saveNodePositions(key, nodes, storage);
            expect(loadStoredNodePositions(key, storage)).toEqual(storedPositions);
        });

        it('returns null when nothing is stored', () => {
            expect(loadStoredNodePositions(key, storage)).toBeNull();
        });

        it('returns null for malformed JSON', () => {
            storage.setItem(`${STORAGE_PREFIX}${key}`, 'this is not json');
            expect(loadStoredNodePositions(key, storage)).toBeNull();
        });

        it('returns null for valid JSON that is not an array', () => {
            storage.setItem(`${STORAGE_PREFIX}${key}`, '{"id":"node-1"}');
            expect(loadStoredNodePositions(key, storage)).toBeNull();
        });

        it('falls back to the pre-calmType-qualified key and migrates it forward', () => {
            const legacyKey = 'finos/42';
            const newKey = 'finos/Architectures/42';
            saveNodePositions(legacyKey, nodes, storage);

            expect(loadStoredNodePositions(newKey, storage)).toEqual(storedPositions);
            // Migrated: readable directly under the new key next time, and the
            // legacy entry is gone so it can't resurface for a different diagram.
            expect(storage.getItem(`${STORAGE_PREFIX}${newKey}`)).not.toBeNull();
            expect(storage.getItem(`${STORAGE_PREFIX}${legacyKey}`)).toBeNull();
        });

        it('does not fall back when the current key already has stored positions', () => {
            const legacyKey = 'finos/42';
            const newKey = 'finos/Architectures/42';
            saveNodePositions(legacyKey, [{ id: 'legacy-node', position: { x: 1, y: 1 }, data: {} }], storage);
            saveNodePositions(newKey, nodes, storage);

            expect(loadStoredNodePositions(newKey, storage)).toEqual(storedPositions);
            // Untouched: the legacy entry belongs to whichever other diagram (if
            // any) still needs it — only an empty current key triggers migration.
            expect(storage.getItem(`${STORAGE_PREFIX}${legacyKey}`)).not.toBeNull();
        });

        it('does not attempt a fallback for a key that has no legacy shape', () => {
            // A dropped file's key (undefined) never reaches here; a 2-segment key
            // like the pre-existing `key` fixture already IS the legacy shape.
            expect(loadStoredNodePositions(key, storage)).toBeNull();
            expect(storage.length).toBe(0);
        });
    });

    describe('buildViewportKey', () => {
        it('joins namespace, calmType and id with a slash', () => {
            expect(buildViewportKey('finos', 'Architectures', 42)).toBe('finos/Architectures/42');
        });

        it('accepts a string id, matching a resolved slug id', () => {
            expect(buildViewportKey('finos', 'Patterns', '7')).toBe('finos/Patterns/7');
        });

        it('round-trips through legacyStorageKeyFor\'s three-segment recognition', () => {
            const legacyKey = 'finos/42';
            const newKey = buildViewportKey('finos', 'Architectures', 42);
            saveNodePositions(legacyKey, nodes, storage);

            expect(loadStoredNodePositions(newKey, storage)).toEqual(storedPositions);
        });
    });

    describe('applyStoredPositions', () => {
        it('returns the input nodes unchanged when nothing is stored', () => {
            const parsed: Node[] = [{ id: 'node-1', position: { x: 0, y: 0 }, data: {} }];
            expect(applyStoredPositions(key, parsed, storage)).toBe(parsed);
        });

        it('restores stored positions onto parsed nodes by id', () => {
            saveNodePositions(key, nodes, storage);
            const parsed: Node[] = [
                { id: 'node-1', position: { x: 0, y: 0 }, data: {} },
                { id: 'node-2', position: { x: 0, y: 0 }, data: {} },
            ];
            const result = applyStoredPositions(key, parsed, storage);
            expect(result.find((n) => n.id === 'node-1')!.position).toEqual({ x: 100, y: 200 });
            expect(result.find((n) => n.id === 'node-2')!.position).toEqual({ x: 300, y: 400 });
        });

        it('leaves nodes without a stored position untouched', () => {
            saveNodePositions(key, [{ id: 'node-1', position: { x: 50, y: 60 }, data: {} }], storage);
            const parsed: Node[] = [
                { id: 'node-1', position: { x: 0, y: 0 }, data: {} },
                { id: 'node-new', position: { x: 7, y: 8 }, data: {} },
            ];
            const result = applyStoredPositions(key, parsed, storage);
            expect(result.find((n) => n.id === 'node-1')!.position).toEqual({ x: 50, y: 60 });
            expect(result.find((n) => n.id === 'node-new')!.position).toEqual({ x: 7, y: 8 });
        });

        it('resizes containers to enclose restored children', () => {
            // A container with one child; storing the child further out should
            // make the reflow grow the container to keep it enclosed.
            const child: Node = { id: 'child', parentId: 'group', position: { x: 0, y: 0 }, data: {} };
            saveNodePositions(key, [{ ...child, position: { x: 500, y: 400 } }], storage);
            const parsed: Node[] = [
                { id: 'group', type: 'group', position: { x: 0, y: 0 }, width: 50, height: 50, data: {} },
                child,
            ];
            const result = applyStoredPositions(key, parsed, storage);
            const container = result.find((n) => n.id === 'group')!;
            expect(container.width).toBeGreaterThan(50);
            expect(container.height).toBeGreaterThan(50);
        });
    });

    describe('toStoredPositions', () => {
        it('reduces nodes to id and position only', () => {
            expect(toStoredPositions(nodes)).toEqual(storedPositions);
        });

        it('serialises the same shape saveNodePositions persists', () => {
            saveNodePositions(key, nodes, storage);
            expect(loadStoredNodePositions(key, storage)).toEqual(toStoredPositions(nodes));
        });
    });

    describe('clearStoredNodePositions', () => {
        it('removes a previously stored entry', () => {
            saveNodePositions(key, nodes, storage);
            clearStoredNodePositions(key, storage);
            expect(loadStoredNodePositions(key, storage)).toBeNull();
        });

        it('does not affect other diagram keys', () => {
            saveNodePositions('a/1', nodes, storage);
            saveNodePositions('b/1', nodes, storage);
            clearStoredNodePositions('a/1', storage);
            expect(loadStoredNodePositions('a/1', storage)).toBeNull();
            expect(loadStoredNodePositions('b/1', storage)).toEqual(storedPositions);
        });

        it('is a no-op when nothing is stored', () => {
            expect(() => clearStoredNodePositions(key, storage)).not.toThrow();
        });
    });

    describe('applyPositions', () => {
        it('returns the input nodes unchanged when positions is null', () => {
            const parsed: Node[] = [{ id: 'node-1', position: { x: 0, y: 0 }, data: {} }];
            expect(applyPositions(parsed, null)).toBe(parsed);
        });

        it('returns the input nodes unchanged when positions is empty', () => {
            const parsed: Node[] = [{ id: 'node-1', position: { x: 0, y: 0 }, data: {} }];
            expect(applyPositions(parsed, [])).toBe(parsed);
        });

        it('merges the given positions by id', () => {
            const parsed: Node[] = [
                { id: 'node-1', position: { x: 0, y: 0 }, data: {} },
                { id: 'node-2', position: { x: 0, y: 0 }, data: {} },
            ];
            const result = applyPositions(parsed, storedPositions);
            expect(result.find((n) => n.id === 'node-1')!.position).toEqual({ x: 100, y: 200 });
            expect(result.find((n) => n.id === 'node-2')!.position).toEqual({ x: 300, y: 400 });
        });

        it('is what applyStoredPositions delegates to for the merge behaviour', () => {
            saveNodePositions(key, nodes, storage);
            const parsed: Node[] = [
                { id: 'node-1', position: { x: 0, y: 0 }, data: {} },
                { id: 'node-2', position: { x: 0, y: 0 }, data: {} },
            ];
            const viaStorage = applyStoredPositions(key, parsed, storage);
            const viaDirectPositions = applyPositions(parsed, loadStoredNodePositions(key, storage));
            expect(viaStorage).toEqual(viaDirectPositions);
        });

        it('applies width and height when present in positions', () => {
            const parsed: Node[] = [
                { id: 'node-1', position: { x: 0, y: 0 }, data: {} },
            ];
            const positions: StoredNodePosition[] = [
                { id: 'node-1', position: { x: 50, y: 60 }, width: 200, height: 80 },
            ];
            const result = applyPositions(parsed, positions);
            const node = result.find((n) => n.id === 'node-1')! as Node & { width?: number; height?: number };
            expect(node.position).toEqual({ x: 50, y: 60 });
            expect(node.width).toBe(200);
            expect(node.height).toBe(80);
            expect(node.style).toEqual({ width: 200, height: 80 });
        });

        it('skips reflow when all group nodes have explicit dimensions in positions', () => {
            const parsed: Node[] = [
                { id: 'group', type: 'group', position: { x: 0, y: 0 }, data: {} },
                { id: 'child', position: { x: 0, y: 0 }, data: {}, parentId: 'group' } as Node,
            ];
            const positions: StoredNodePosition[] = [
                { id: 'group', position: { x: 10, y: 10 }, width: 500, height: 400 },
                { id: 'child', position: { x: 20, y: 20 }, width: 100, height: 50 },
            ];
            const result = applyPositions(parsed, positions);
            const group = result.find((n) => n.id === 'group')! as Node & { width?: number; height?: number };
            // With full dimensions, reflow is skipped — the group keeps its explicit size
            expect(group.width).toBe(500);
            expect(group.height).toBe(400);
        });
    });

    describe('applyPositions with a child that has no stored position', () => {
        const parsed: Node[] = [
            { id: 'group', type: 'group', position: { x: 0, y: 0 }, data: {} },
            { id: 'child', position: { x: 0, y: 0 }, data: {}, parentId: 'group' } as Node,
            { id: 'copy', position: { x: 20, y: 40 }, data: {}, parentId: 'group' } as Node,
            { id: 'other', type: 'group', position: { x: 0, y: 0 }, data: {} },
            { id: 'x', position: { x: 0, y: 0 }, data: {}, parentId: 'other' } as Node,
        ];
        const positions: StoredNodePosition[] = [
            { id: 'group', position: { x: 10, y: 10 }, width: 410, height: 260 },
            { id: 'child', position: { x: 20, y: 40 } },
            { id: 'other', position: { x: 500, y: 0 }, width: 600, height: 400 },
            { id: 'x', position: { x: 200, y: 150 } },
        ];
        const result = applyPositions(parsed, positions) as (Node & { height?: number; width?: number })[];
        const byId = (id: string) => result.find((n) => n.id === id)!;

        it('places the new child, e.g. a copy of a shared node, below its stored siblings', () => {
            expect(byId('copy').position.y).toBeGreaterThanOrEqual(40 + GRAPH_LAYOUT.NODE_HEIGHT);
        });

        it('grows its container to hold it', () => {
            expect(byId('group').height).toBeGreaterThanOrEqual(byId('copy').position.y + GRAPH_LAYOUT.NODE_HEIGHT);
        });

        it('keeps every other container and child where they were stored', () => {
            expect(byId('other')).toMatchObject({ position: { x: 500, y: 0 }, width: 600, height: 400 });
            expect(byId('x').position).toEqual({ x: 200, y: 150 });
            expect(byId('child').position).toEqual({ x: 20, y: 40 });
        });
    });

    describe('applyPositions with a new child in a nested container', () => {
        const parsed: Node[] = [
            { id: 'ca', type: 'group', position: { x: 0, y: 0 }, data: {} },
            { id: 'ns', type: 'group', position: { x: 0, y: 0 }, data: {}, parentId: 'ca' } as Node,
            { id: 'svc', position: { x: 0, y: 0 }, data: {}, parentId: 'ns' } as Node,
            { id: 'copy', position: { x: 0, y: 0 }, data: {}, parentId: 'ns' } as Node,
            { id: 'cb', type: 'group', position: { x: 0, y: 0 }, data: {} },
        ];
        const positions: StoredNodePosition[] = [
            { id: 'ca', position: { x: 0, y: 0 }, width: 400, height: 300 },
            { id: 'ns', position: { x: 20, y: 40 }, width: 300, height: 200 },
            { id: 'svc', position: { x: 20, y: 40 } },
            { id: 'cb', position: { x: 0, y: 320 }, width: 400, height: 300 },
        ];
        const result = applyPositions(parsed, positions) as (Node & { height?: number; width?: number })[];
        const byId = (id: string) => result.find((n) => n.id === id)!;

        it('grows the inner container, then the outer container to hold it', () => {
            expect(byId('ns').height).toBeGreaterThanOrEqual(byId('copy').position.y + GRAPH_LAYOUT.NODE_HEIGHT);
            expect(byId('ca').height).toBeGreaterThanOrEqual(byId('ns').position.y + byId('ns').height!);
        });

        it('does not move the containers around it', () => {
            expect(byId('cb')).toMatchObject({ position: { x: 0, y: 320 }, width: 400, height: 300 });
        });
    });

    describe('applyPositions with a new copy of a container', () => {
        // ns is in c1 and c2. The layout was saved before ns had a copy in c2.
        const parsed: Node[] = [
            { id: 'c1', type: 'group', position: { x: 0, y: 0 }, data: {} },
            { id: 'ns', type: 'group', position: { x: 0, y: 0 }, data: {}, parentId: 'c1' } as Node,
            { id: 'svc', position: { x: 0, y: 0 }, data: {}, parentId: 'ns' } as Node,
            { id: 'c2', type: 'group', position: { x: 0, y: 0 }, data: {} },
            { id: 'b', position: { x: 0, y: 0 }, data: {}, parentId: 'c2' } as Node,
            { id: 'ns__in__c2', type: 'group', position: { x: 20, y: 40 }, data: {}, parentId: 'c2' } as Node,
            { id: 'svc__in__ns__in__c2', position: { x: 0, y: 0 }, data: {}, parentId: 'ns__in__c2' } as Node,
        ];
        const positions: StoredNodePosition[] = [
            { id: 'c1', position: { x: 0, y: 0 }, width: 400, height: 300 },
            { id: 'ns', position: { x: 20, y: 40 }, width: 300, height: 200 },
            { id: 'svc', position: { x: 20, y: 40 } },
            { id: 'c2', position: { x: 500, y: 0 }, width: 400, height: 300 },
            { id: 'b', position: { x: 20, y: 40 } },
        ];
        const result = applyPositions(parsed, positions) as (Node & { height?: number; width?: number })[];
        const byId = (id: string) => result.find((n) => n.id === id)!;

        it('places the copy below its stored siblings', () => {
            expect(byId('ns__in__c2').position.y).toBeGreaterThanOrEqual(40 + GRAPH_LAYOUT.NODE_HEIGHT);
        });

        it('keeps the stored nodes where they were stored', () => {
            expect(byId('b').position).toEqual({ x: 20, y: 40 });
            expect(byId('c1')).toMatchObject({ position: { x: 0, y: 0 }, width: 400, height: 300 });
            expect(byId('ns')).toMatchObject({ position: { x: 20, y: 40 }, width: 300, height: 200 });
        });

        it('grows the container of the copy to hold it', () => {
            expect(byId('c2').height).toBeGreaterThanOrEqual(byId('ns__in__c2').position.y + byId('ns__in__c2').height!);
        });
    });

    describe('toStoredPositions with dimensions', () => {
        it('captures width and height from node.width/height', () => {
            const nodesWithDimensions: Node[] = [
                { id: 'node-1', position: { x: 10, y: 20 }, data: {}, width: 150, height: 60 } as Node,
            ];
            const result = toStoredPositions(nodesWithDimensions);
            expect(result[0]).toEqual({ id: 'node-1', position: { x: 10, y: 20 }, width: 150, height: 60 });
        });

        it('captures width and height from node.measured when node.width is absent', () => {
            const nodesWithMeasured = [
                { id: 'node-1', position: { x: 10, y: 20 }, data: {}, measured: { width: 180, height: 70 } },
            ] as unknown as Node[];
            const result = toStoredPositions(nodesWithMeasured);
            expect(result[0]).toEqual({ id: 'node-1', position: { x: 10, y: 20 }, width: 180, height: 70 });
        });

        it('omits width/height when neither node.width nor measured is present', () => {
            const result = toStoredPositions(nodes);
            expect(result[0]).toEqual({ id: 'node-1', position: { x: 100, y: 200 } });
            expect(result[0]).not.toHaveProperty('width');
            expect(result[0]).not.toHaveProperty('height');
        });
    });
});
