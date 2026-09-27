import { describe, it, expect } from 'vitest';
import {
    completeNodes, composedOf, connectsBetween, connectsNodes, freshOutcomes, interactsWith, nodeById, nodes,
    nodesOfType, ranFailed, ranOk, relationships, validatedEditorFile,
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
