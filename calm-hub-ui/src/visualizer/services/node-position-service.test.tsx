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
    });
});
