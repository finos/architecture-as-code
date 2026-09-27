import { describe, it, expect } from 'vitest';
import {
    completeNodes, composedOf, connectsBetween, connectsNodes, connectsRelationshipsBetween, connectsUsesInterfaces, freshOutcomes, hasMetadata, interactsWith,
    nodeById, nodeInterfaces, nodes, nodesOfType, ranFailed, ranOk, relationships, relationshipsOfKind, validatedEditorFile,
} from './checks';
import type { CommandOutcome } from '../cli/outcome';
import type { LessonState } from './types';

const doc = {
    nodes: [
        { 'unique-id': 'web', 'node-type': 'webclient' },
        { 'unique-id': 'svc', 'node-type': 'service' },
        { 'unique-id': 'db', 'node-type': 'database' },
        { 'unique-id': 'user', 'node-type': 'actor' },
        { 'unique-id': 'sys', 'node-type': 'system' },
    ],
    relationships: [
        { 'unique-id': 'r1', 'relationship-type': { connects: { source: { node: 'svc' }, destination: { node: 'db' } } } },
        { 'unique-id': 'r2', 'relationship-type': { interacts: { actor: 'user', nodes: ['svc'] } } },
        { 'unique-id': 'r3', 'relationship-type': { 'composed-of': { container: 'sys', nodes: ['svc', 'db'] } } },
    ],
};

describe('document helpers', () => {
    it('never throw on partial or wrong-shaped documents', () => {
        for (const bad of [null, undefined, {}, { nodes: 'x' }, { nodes: [null, 3] }, { relationships: [{ 'relationship-type': null }] }]) {
            expect(nodes(bad as never)).toBeInstanceOf(Array);
            expect(relationships(bad as never)).toBeInstanceOf(Array);
            expect(connectsBetween(bad as never, 'service', 'database')).toBe(false);
            expect(connectsNodes(bad as never, 'svc', 'db')).toBe(false);
            expect(interactsWith(bad as never, 'actor', 'service')).toBe(false);
            expect(composedOf(bad as never, 'system', ['service'])).toBe(false);
        }
    });

    it('find nodes by id and type', () => {
        expect(nodeById(doc, 'db')?.['node-type']).toBe('database');
        expect(nodesOfType(doc, 'service').map((node) => node['unique-id'])).toEqual(['svc']);
    });

    it('match relationships by the types of the nodes they join', () => {
        expect(connectsBetween(doc, 'service', 'database')).toBe(true);
        expect(connectsRelationshipsBetween(doc, 'service', 'database')).toHaveLength(1);
        expect(connectsRelationshipsBetween(doc, 'database', 'service')).toEqual([]);
        expect(connectsBetween(doc, 'database', 'service')).toBe(false);
        expect(interactsWith(doc, 'actor', 'service')).toBe(true);
        expect(interactsWith(doc, 'actor', 'database')).toBe(false);
        expect(composedOf(doc, 'system', ['service', 'database'])).toBe(true);
        expect(composedOf(doc, 'system', ['service', 'actor'])).toBe(false);
    });

    it('match a connects by the ids of the nodes it joins, in direction', () => {
        expect(connectsNodes(doc, 'svc', 'db')).toBe(true);
        expect(connectsNodes(doc, 'db', 'svc')).toBe(false);
        expect(connectsNodes(doc, 'web', 'svc')).toBe(false);
    });

    it('ignore relationships that point at missing nodes', () => {
        const dangling = { ...doc, relationships: [{ 'relationship-type': { connects: { source: { node: 'svc' }, destination: { node: 'gone' } } } }] };
        expect(connectsBetween(dangling, 'service', 'database')).toBe(false);
        expect(connectsNodes(dangling, 'svc', 'gone')).toBe(false);
    });
});

describe('completeNodes', () => {
    it('matches a node with all four required properties', () => {
        const complete = { nodes: [{ 'unique-id': 'a', 'node-type': 'service', name: 'A', description: 'x' }] };
        expect(completeNodes(complete).map((node) => node['unique-id'])).toEqual(['a']);
    });

    it('does not match a node missing or blank on a required property', () => {
        const missingField = { nodes: [{ 'unique-id': 'a', 'node-type': 'service', name: 'A' }] };
        const blankField = { nodes: [{ 'unique-id': 'a', 'node-type': 'service', name: '', description: 'x' }] };
        expect(completeNodes(missingField)).toEqual([]);
        expect(completeNodes(blankField)).toEqual([]);
    });

    it('never throws on a partial or wrong-shaped document', () => {
        for (const bad of [null, undefined, {}, { nodes: 'x' }, { nodes: [null, 3] }, { nodes: [{ 'unique-id': 1 }] }]) {
            expect(completeNodes(bad as never)).toEqual([]);
        }
    });

    it('only counts complete nodes among a mix', () => {
        const mixed = {
            nodes: [
                { 'unique-id': 'a', 'node-type': 'service', name: 'A', description: 'x' },
                { 'unique-id': 'b', 'node-type': 'service' },
            ],
        };
        expect(completeNodes(mixed)).toHaveLength(1);
    });
});

describe('nodeInterfaces', () => {
    it('matches interface items with a non-empty string unique-id', () => {
        const node = { interfaces: [{ 'unique-id': 'api', protocol: 'HTTPS' }, { protocol: 'HTTPS' }, { 'unique-id': '' }] };
        expect(nodeInterfaces(node).map((iface) => iface['unique-id'])).toEqual(['api']);
    });

    it('does not match when there are no usable interfaces', () => {
        expect(nodeInterfaces({ interfaces: [] })).toEqual([]);
        expect(nodeInterfaces({ interfaces: [{ protocol: 'HTTPS' }] })).toEqual([]);
    });

    it('never throws on a partial or wrong-shaped node', () => {
        for (const bad of [null, undefined, {}, { interfaces: 'x' }, { interfaces: [null, 3] }]) {
            expect(nodeInterfaces(bad as never)).toEqual([]);
        }
    });
});

describe('connectsUsesInterfaces', () => {
    const withInterfaces = {
        nodes: [
            { 'unique-id': 'svc', 'node-type': 'service', interfaces: [{ 'unique-id': 'svc-api' }] },
            { 'unique-id': 'db', 'node-type': 'database', interfaces: [{ 'unique-id': 'db-jdbc' }] },
        ],
        relationships: [
            {
                'unique-id': 'r1',
                'relationship-type': {
                    connects: {
                        source: { node: 'svc', interfaces: ['svc-api'] },
                        destination: { node: 'db', interfaces: ['db-jdbc'] },
                    },
                },
            },
        ],
    };

    it('matches a connects whose ends each reference one of that node\'s interfaces', () => {
        expect(connectsUsesInterfaces(withInterfaces, 'service', 'database')).toBe(true);
    });

    it('does not match when the connects names no interfaces', () => {
        const noInterfaces = {
            ...withInterfaces,
            relationships: [{
                'unique-id': 'r1',
                'relationship-type': { connects: { source: { node: 'svc' }, destination: { node: 'db' } } },
            }],
        };
        expect(connectsUsesInterfaces(noInterfaces, 'service', 'database')).toBe(false);
        expect(connectsUsesInterfaces(withInterfaces, 'database', 'service')).toBe(false);
    });

    it('never throws on a partial or wrong-shaped document', () => {
        for (const bad of [null, undefined, {}, { nodes: 'x' }, { relationships: [{ 'relationship-type': null }] }]) {
            expect(connectsUsesInterfaces(bad as never, 'service', 'database')).toBe(false);
        }
    });

    it('does not match a dangling interface id: named on the relationship but absent from the node', () => {
        const dangling = {
            ...withInterfaces,
            relationships: [{
                'unique-id': 'r1',
                'relationship-type': {
                    connects: {
                        source: { node: 'svc', interfaces: ['does-not-exist'] },
                        destination: { node: 'db', interfaces: ['db-jdbc'] },
                    },
                },
            }],
        };
        expect(connectsUsesInterfaces(dangling, 'service', 'database')).toBe(false);
    });
});

describe('hasMetadata', () => {
    it('matches a non-empty metadata object', () => {
        expect(hasMetadata({ metadata: { owner: 'team' } })).toBe(true);
    });

    it('matches a non-empty array of non-empty metadata objects', () => {
        expect(hasMetadata({ metadata: [{ key: 'owner', value: 'team' }] })).toBe(true);
    });

    it('does not match an empty object, an empty array, or an array containing an empty object', () => {
        expect(hasMetadata({ metadata: {} })).toBe(false);
        expect(hasMetadata({ metadata: [] })).toBe(false);
        expect(hasMetadata({ metadata: [{ key: 'owner', value: 'team' }, {}] })).toBe(false);
    });

    it('never throws on a partial or wrong-shaped item', () => {
        for (const bad of [null, undefined, {}, { metadata: null }, { metadata: 'x' }, { metadata: 3 }, { metadata: [null, 3] }]) {
            expect(hasMetadata(bad as never)).toBe(false);
        }
    });
});

describe('relationshipsOfKind', () => {
    const doc2 = {
        relationships: [
            { 'unique-id': 'r1', 'relationship-type': { connects: { source: { node: 'svc' }, destination: { node: 'db' } } }, metadata: { latency: '< 50ms' } },
            { 'unique-id': 'r2', 'relationship-type': { interacts: { actor: 'user', nodes: ['svc'] } } },
        ],
    };

    it('matches relationships whose relationship-type has that kind', () => {
        expect(relationshipsOfKind(doc2, 'connects').map((rel) => rel['unique-id'])).toEqual(['r1']);
    });

    it('does not match when no relationship has that kind', () => {
        expect(relationshipsOfKind(doc2, 'deployed-in')).toEqual([]);
    });

    it('never throws on a partial or wrong-shaped document', () => {
        for (const bad of [null, undefined, {}, { relationships: 'x' }, { relationships: [{ 'relationship-type': null }] }, { relationships: [{ 'relationship-type': { connects: 'x' } }] }]) {
            expect(relationshipsOfKind(bad as never, 'connects')).toEqual([]);
        }
    });
});

const outcome = (over: Partial<CommandOutcome>): CommandOutcome => ({
    command: 'validate',
    files: { architecture: '/workspace/a.json' },
    ok: true,
    errorCount: 0,
    warningCount: 0,
    snapshot: { '/workspace/a.json': 'v1' },
    ...over,
});
const state = (commands: CommandOutcome[]): LessonState => ({ doc: null, validation: { ok: true }, commands, editorFile: '/workspace/a.json' });

describe('command outcomes', () => {
    it('drop an outcome once a file it read has changed', () => {
        const files: Record<string, string> = { '/workspace/a.json': 'v2' };
        expect(freshOutcomes([outcome({})], (path) => files[path] ?? null)).toEqual([]);
        files['/workspace/a.json'] = 'v1';
        expect(freshOutcomes([outcome({})], (path) => files[path] ?? null)).toHaveLength(1);
    });

    it('match by command and resolved files', () => {
        const s = state([outcome({}), outcome({ command: 'diff', ok: false, files: { documentA: '/workspace/a.json', documentB: '/workspace/b.json' } })]);
        expect(ranOk(s, 'validate')).toBe(true);
        expect(ranOk(s, 'validate', { architecture: '/workspace/a.json' })).toBe(true);
        expect(ranOk(s, 'validate', { architecture: '/workspace/b.json' })).toBe(false);
        expect(ranOk(s, 'diff')).toBe(false);
        expect(ranFailed(s, 'diff', { documentB: '/workspace/b.json' })).toBe(true);
        expect(validatedEditorFile(s)).toBe(true);
    });
});
