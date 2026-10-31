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

describe('parseCALMData - nodes with several parents', () => {
    const node = (id: string) => ({ 'unique-id': id, 'node-type': 'system', name: id });
    const deployedIn = (id: string, container: string, nodes: string[]) =>
        ({ 'unique-id': id, 'relationship-type': { 'deployed-in': { container, nodes } } });
    const byId = (nodes: { id: string }[], id: string) => nodes.find((n) => n.id === id) as any;

    it('ignores a member of a containment relationship that is not a node', () => {
        const result = parseCALMData(arch([node('c'), node('a')], [deployedIn('r1', 'c', ['ghost', 'a'])]));
        expect(result.nodes.map((n) => [n.id, n.parentId])).toEqual([['c', undefined], ['a', 'c']]);
    });

    it('lists a membership that is not drawn once, however often the file repeats it', () => {
        const result = parseCALMData(arch([node('x')], [deployedIn('r1', 'ghost', ['x']), deployedIn('r2', 'ghost', ['x'])]));
        expect(byId(result.nodes, 'x').data.otherParents).toEqual(['ghost']);
    });

    it('sizes a container past the copy limit by the children drawn in it only', () => {
        // Each level has two containers that are both in both containers of the level above.
        // Past the limit, each is drawn in its last container only, so l0a holds nothing.
        const ids = Array.from({ length: 12 }, (_, k) => [`l${k}a`, `l${k}b`]);
        const result = parseCALMData(arch(
            ids.flat().map(node),
            ids.slice(1).flatMap(([a, b], k) => [deployedIn(`r${k}a`, ids[k][0], [a, b]), deployedIn(`r${k}b`, ids[k][1], [a, b])]),
        ));
        expect(result.nodes.some((n) => n.parentId === 'l0a')).toBe(false);
        expect(byId(result.nodes, 'l0a').width).toBe(500);
        expect(byId(result.nodes, 'l0b').width).toBeGreaterThan(500);
    });

    it('draws a node once in each parent, and keeps the CALM id in the last parent as before', () => {
        const result = parseCALMData(arch(
            [node('cluster-a'), node('cluster-b'), node('ns')],
            [deployedIn('r1', 'cluster-a', ['ns']), deployedIn('r2', 'cluster-b', ['ns'])],
        ));
        const copies = result.nodes.filter((n) => n.data.calmId === 'ns');
        expect(copies.map((n) => [n.id, n.parentId])).toEqual([
            ['ns', 'cluster-b'],
            ['ns__in__cluster-a', 'cluster-a'],
        ]);
        expect(copies[1].data.label).toBe('ns');
    });

    it('copies everything nested in a shared container', () => {
        const result = parseCALMData(arch(
            [node('cluster-a'), node('cluster-b'), node('ns'), node('svc')],
            [
                deployedIn('r1', 'cluster-a', ['ns']),
                deployedIn('r2', 'cluster-b', ['ns']),
                deployedIn('r3', 'ns', ['svc']),
            ],
        ));
        expect(byId(result.nodes, 'ns__in__cluster-a').type).toBe('container');
        expect(result.nodes.filter((n) => n.data.calmId === 'svc').map((n) => [n.id, n.parentId])).toEqual([
            ['svc', 'ns'],
            ['svc__in__ns__in__cluster-a', 'ns__in__cluster-a'],
        ]);
    });

    it('lists a parent once when relationships repeat it', () => {
        const result = parseCALMData(arch(
            [node('cluster'), node('ns')],
            [deployedIn('r1', 'cluster', ['ns']), deployedIn('r2', 'cluster', ['ns'])],
        ));
        expect(result.nodes.filter((n) => n.data.calmId === 'ns')).toHaveLength(1);
    });

    it('keeps edges on the original node', () => {
        const result = parseCALMData(arch(
            [node('cluster-a'), node('cluster-b'), node('ns'), node('client')],
            [
                deployedIn('r1', 'cluster-a', ['ns']),
                deployedIn('r2', 'cluster-b', ['ns']),
                { 'unique-id': 'c1', 'relationship-type': { connects: { source: { node: 'client' }, destination: { node: 'ns' } } } },
            ],
        ));
        expect(result.edges.map((e) => [e.source, e.target])).toEqual([['client', 'ns']]);
    });

    it('does not give a copy the id of a real node', () => {
        const result = parseCALMData(arch(
            [node('a'), node('b'), node('x'), node('x__in__a')],
            [deployedIn('r1', 'a', ['x']), deployedIn('r2', 'b', ['x'])],
        ));
        const ids = result.nodes.map((n) => n.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(byId(result.nodes, 'x__in__a').data.calmId).toBe('x__in__a');
    });

    it('puts every container before the nodes inside it', () => {
        const result = parseCALMData(arch(
            [node('svc'), node('ns'), node('cluster-a'), node('cluster-b')],
            [deployedIn('r1', 'cluster-a', ['ns']), deployedIn('r2', 'cluster-b', ['ns']), deployedIn('r3', 'ns', ['svc'])],
        ));
        const ids = result.nodes.map((n) => n.id);
        for (const n of result.nodes) {
            if (n.parentId) expect(ids.indexOf(n.parentId)).toBeLessThan(ids.indexOf(n.id));
        }
    });

    it('ignores a node listed as its own container', () => {
        const result = parseCALMData(arch([node('a'), node('b')], [deployedIn('r1', 'a', ['a', 'b'])]));
        expect(result.nodes.map((n) => [n.id, n.parentId])).toEqual([['a', undefined], ['b', 'a']]);
    });

    it('counts only copies against the limit, not every node', () => {
        const singles = Array.from({ length: 1001 }, (_, k) => node(`n${k}`));
        const result = parseCALMData(arch(
            [node('cluster-a'), node('cluster-b'), node('ns'), ...singles],
            [deployedIn('r1', 'cluster-a', ['ns']), deployedIn('r2', 'cluster-b', ['ns'])],
        ));
        expect(result.nodes.filter((n) => n.data.calmId === 'ns')).toHaveLength(2);
    });

    it('keeps the CALM id in the container of the last relationship when a container repeats', () => {
        const result = parseCALMData(arch(
            [node('A'), node('B'), node('N')],
            [deployedIn('r1', 'A', ['N']), deployedIn('r2', 'B', ['N']), deployedIn('r3', 'A', ['N'])],
        ));
        expect(result.nodes.filter((n) => n.data.calmId === 'N').map((n) => [n.id, n.parentId])).toEqual([
            ['N', 'A'],
            ['N__in__B', 'B'],
        ]);
    });

    it('draws a node once when it is listed in both a container and a container inside it', () => {
        const result = parseCALMData(arch(
            [node('cluster'), node('ns'), node('svc')],
            [deployedIn('r1', 'cluster', ['ns', 'svc']), deployedIn('r2', 'ns', ['svc'])],
        ));
        expect(result.nodes.filter((n) => n.data.calmId === 'svc').map((n) => [n.id, n.parentId])).toEqual([['svc', 'ns']]);
    });

    it('sizes a container listed as its own member like one without that member', () => {
        const withSelf = parseCALMData(arch([node('a'), node('b')], [deployedIn('r1', 'a', ['a', 'b'])]));
        const plain = parseCALMData(arch([node('a'), node('b')], [deployedIn('r1', 'a', ['b'])]));
        expect(byId(withSelf.nodes, 'a').width).toBe(byId(plain.nodes, 'a').width);
    });

    it('stops at a containment cycle', () => {
        const result = parseCALMData(arch(
            [node('a'), node('b')],
            [deployedIn('r1', 'a', ['b']), deployedIn('r2', 'b', ['a'])],
        ));
        expect(result.nodes.map((n) => n.data.calmId).sort()).toEqual(['a', 'b']);
    });
});

