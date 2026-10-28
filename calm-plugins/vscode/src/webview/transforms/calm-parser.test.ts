import { describe, it, expect } from 'vitest';
import { parseCALMData } from './calm-parser';
import type { CalmArchitecture } from './calm-editor-transformer';

function arch(nodes: unknown[], relationships: unknown[] = []): CalmArchitecture {
    return { nodes, relationships } as CalmArchitecture;
}

describe('parseCALMData', () => {
    it('returns empty for null input', () => {
        const result = parseCALMData(null as unknown as CalmArchitecture);
        expect(result.nodes).toHaveLength(0);
        expect(result.edges).toHaveLength(0);
    });

    it('returns empty for architecture with no nodes', () => {
        const result = parseCALMData({ nodes: [] } as unknown as CalmArchitecture);
        expect(result.nodes).toHaveLength(0);
    });

    it('parses simple nodes', () => {
        const result = parseCALMData(arch([
            { 'unique-id': 'svc-1', 'node-type': 'service', name: 'API', description: 'API Service' },
            { 'unique-id': 'db-1', 'node-type': 'database', name: 'DB', description: 'Database' },
        ]));
        expect(result.nodes).toHaveLength(2);
        expect(result.nodes[0].id).toBe('svc-1');
        expect(result.nodes[0].data.label).toBe('API');
        expect(result.nodes[0].data.calmType).toBe('service');
        expect(result.nodes[1].type).toBe('database');
    });

    it('resolves known node types', () => {
        const types = ['service', 'actor', 'database', 'webclient', 'system', 'ecosystem', 'network', 'ldap', 'data-asset'];
        for (const t of types) {
            const result = parseCALMData(arch([{ 'unique-id': 'n', 'node-type': t, name: 'N' }]));
            expect(result.nodes[0].type).toBe(t);
        }
    });

    it('maps datastore to database', () => {
        const result = parseCALMData(arch([{ 'unique-id': 'n', 'node-type': 'datastore', name: 'N' }]));
        expect(result.nodes[0].type).toBe('database');
    });

    it('maps unknown types to system', () => {
        const result = parseCALMData(arch([{ 'unique-id': 'n', 'node-type': 'custom-thing', name: 'N' }]));
        expect(result.nodes[0].type).toBe('system');
    });

    it('maps namespaced types to extension', () => {
        const result = parseCALMData(arch([{ 'unique-id': 'n', 'node-type': 'aws:lambda', name: 'N' }]));
        expect(result.nodes[0].type).toBe('extension');
    });

    it('parses connects relationships into edges', () => {
        const result = parseCALMData(arch(
            [
                { 'unique-id': 'a', 'node-type': 'service', name: 'A' },
                { 'unique-id': 'b', 'node-type': 'service', name: 'B' },
            ],
            [{
                'unique-id': 'rel-1',
                'relationship-type': {
                    connects: { source: { node: 'a' }, destination: { node: 'b' } },
                },
                protocol: 'HTTPS',
            }]
        ));
        expect(result.edges).toHaveLength(1);
        expect(result.edges[0].source).toBe('a');
        expect(result.edges[0].target).toBe('b');
    });

    it('merges bidirectional connects into single edge', () => {
        const result = parseCALMData(arch(
            [
                { 'unique-id': 'a', 'node-type': 'service', name: 'A' },
                { 'unique-id': 'b', 'node-type': 'service', name: 'B' },
            ],
            [
                { 'unique-id': 'r1', 'relationship-type': { connects: { source: { node: 'a' }, destination: { node: 'b' } } } },
                { 'unique-id': 'r2', 'relationship-type': { connects: { source: { node: 'b' }, destination: { node: 'a' } } } },
            ]
        ));
        expect(result.edges).toHaveLength(1);
        expect(result.edges[0].data.direction).toBe('bidirectional');
    });

    it('merges a connects pair whose data differs only in key order', () => {
        const result = parseCALMData(arch(
            [
                { 'unique-id': 'a', 'node-type': 'service', name: 'A' },
                { 'unique-id': 'b', 'node-type': 'service', name: 'B' },
            ],
            [
                { 'unique-id': 'r1', 'relationship-type': { connects: { source: { node: 'a' }, destination: { node: 'b' } } }, metadata: { x: 1, y: 2 } },
                { 'unique-id': 'r2', 'relationship-type': { connects: { source: { node: 'b' }, destination: { node: 'a' } } }, metadata: { y: 2, x: 1 } },
            ]
        ));
        expect(result.edges).toHaveLength(1);
        expect(result.edges[0].data.calmReverseRelId).toBe('r2');
    });

    it('does not merge a connects pair with different data', () => {
        const result = parseCALMData(arch(
            [
                { 'unique-id': 'a', 'node-type': 'service', name: 'A' },
                { 'unique-id': 'b', 'node-type': 'service', name: 'B' },
            ],
            [
                { 'unique-id': 'r1', description: 'A calls B', 'relationship-type': { connects: { source: { node: 'a' }, destination: { node: 'b' } } } },
                { 'unique-id': 'r2', description: 'B reads A', 'relationship-type': { connects: { source: { node: 'b' }, destination: { node: 'a' } } } },
            ]
        ));
        expect(result.edges.map((e) => [e.id, e.data.description, e.data.direction])).toEqual([
            ['r1', 'A calls B', 'source-to-target'],
            ['r2', 'B reads A', 'source-to-target'],
        ]);
    });

    it('parses deployed-in containment', () => {
        const result = parseCALMData(arch(
            [
                { 'unique-id': 'vpc', 'node-type': 'network', name: 'VPC' },
                { 'unique-id': 'svc', 'node-type': 'service', name: 'Service' },
            ],
            [{
                'unique-id': 'rel-1',
                'relationship-type': {
                    'deployed-in': { container: 'vpc', nodes: ['svc'] },
                },
            }]
        ));
        const vpc = result.nodes.find(n => n.id === 'vpc');
        const svc = result.nodes.find(n => n.id === 'svc');
        expect(vpc?.type).toBe('container');
        expect(svc?.parentId).toBe('vpc');
    });

    it('parses interacts relationships', () => {
        const result = parseCALMData(arch(
            [
                { 'unique-id': 'user', 'node-type': 'actor', name: 'User' },
                { 'unique-id': 'app', 'node-type': 'webclient', name: 'App' },
            ],
            [{
                'unique-id': 'rel-1',
                'relationship-type': { interacts: { actor: 'user', nodes: ['app'] } },
                description: 'Uses',
            }]
        ));
        expect(result.edges).toHaveLength(1);
        expect(result.edges[0].data.calmVariant).toBe('interacts');
    });

    it('sizes containers dynamically based on descendant count', () => {
        const result = parseCALMData(arch(
            [
                { 'unique-id': 'c', 'node-type': 'network', name: 'Container' },
                { 'unique-id': 'a', 'node-type': 'service', name: 'A' },
                { 'unique-id': 'b', 'node-type': 'service', name: 'B' },
                { 'unique-id': 'd', 'node-type': 'service', name: 'D' },
            ],
            [{
                'unique-id': 'rel-1',
                'relationship-type': { 'deployed-in': { container: 'c', nodes: ['a', 'b', 'd'] } },
            }]
        ));
        const container = result.nodes.find(n => n.id === 'c');
        expect(container!.width).toBeGreaterThan(500);
    });

    it('preserves metadata on edges', () => {
        const result = parseCALMData(arch(
            [
                { 'unique-id': 'a', 'node-type': 'service', name: 'A' },
                { 'unique-id': 'b', 'node-type': 'service', name: 'B' },
            ],
            [{
                'unique-id': 'rel-1',
                'relationship-type': { connects: { source: { node: 'a' }, destination: { node: 'b' } } },
                metadata: { 'line-style': 'dashed', routing: 'step', custom: 'value' },
            }]
        ));
        expect(result.edges[0].data.lineStyle).toBe('dashed');
        expect(result.edges[0].data.routing).toBe('step');
        expect(result.edges[0].data.edgeMetadata.custom).toBe('value');
    });
});
