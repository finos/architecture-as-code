import { describe, it, expect, vi } from 'vitest';
import { parseCALMData } from './calmTransformer';
import { CalmArchitectureSchema } from '@finos/calm-models/types';
import { GRAPH_LAYOUT } from './constants';

describe('parseCALMData', () => {
    it('returns empty arrays for null data', () => {
        const result = parseCALMData(null as unknown as CalmArchitectureSchema);
        expect(result.nodes).toEqual([]);
        expect(result.edges).toEqual([]);
    });

    it('returns empty arrays for undefined data', () => {
        const result = parseCALMData(undefined as unknown as CalmArchitectureSchema);
        expect(result.nodes).toEqual([]);
        expect(result.edges).toEqual([]);
    });

    it('creates nodes from CALM nodes', () => {
        const data: CalmArchitectureSchema = {
            nodes: [
                { 'unique-id': 'node-1', name: 'Service A', 'node-type': 'service' },
                { 'unique-id': 'node-2', name: 'Database B', 'node-type': 'database' },
            ],
        };
        const result = parseCALMData(data);
        expect(result.nodes).toHaveLength(2);
        expect(result.nodes[0].id).toBe('node-1');
        expect(result.nodes[0].data.label).toBe('Service A');
        expect(result.nodes[0].type).toBe('custom');
        expect(result.nodes[1].id).toBe('node-2');
    });

    it('renders a childless system node as a regular node', () => {
        const data: CalmArchitectureSchema = {
            nodes: [
                { 'unique-id': 'system-1', name: 'My System', 'node-type': 'system' },
            ],
        };
        const result = parseCALMData(data);
        expect(result.nodes).toHaveLength(1);
        expect(result.nodes[0].type).toBe('custom');
        expect(result.nodes[0].data['node-type']).toBe('system');
    });

    it('renders a system node that contains children as a group node', () => {
        const data: CalmArchitectureSchema = {
            nodes: [
                { 'unique-id': 'system-1', name: 'My System', 'node-type': 'system' },
                { 'unique-id': 'child-1', name: 'Child Service', 'node-type': 'service' },
            ],
            relationships: [
                {
                    'unique-id': 'rel-1',
                    'relationship-type': {
                        'composed-of': { container: 'system-1', nodes: ['child-1'] },
                    },
                },
            ],
        };
        const result = parseCALMData(data);
        const systemNode = result.nodes.find((n) => n.id === 'system-1');
        expect(systemNode?.type).toBe('group');
    });

    it('creates edges from connects relationships', () => {
        const data: CalmArchitectureSchema = {
            nodes: [
                { 'unique-id': 'node-1', name: 'Service A', 'node-type': 'service' },
                { 'unique-id': 'node-2', name: 'Service B', 'node-type': 'service' },
            ],
            relationships: [
                {
                    'unique-id': 'rel-1',
                    description: 'connects to',
                    'relationship-type': {
                        connects: {
                            source: { node: 'node-1' },
                            destination: { node: 'node-2' },
                        },
                    },
                },
            ],
        };
        const result = parseCALMData(data);
        expect(result.edges).toHaveLength(1);
        expect(result.edges[0].source).toBe('node-1');
        expect(result.edges[0].target).toBe('node-2');
        expect(result.edges[0].data.description).toBe('connects to');
    });

    it('creates edges from interacts relationships', () => {
        const data: CalmArchitectureSchema = {
            nodes: [
                { 'unique-id': 'actor-1', name: 'User', 'node-type': 'actor' },
                { 'unique-id': 'node-1', name: 'Service A', 'node-type': 'service' },
            ],
            relationships: [
                {
                    'unique-id': 'rel-1',
                    description: 'uses',
                    'relationship-type': {
                        interacts: {
                            actor: 'actor-1',
                            nodes: ['node-1'],
                        },
                    },
                },
            ],
        };
        const result = parseCALMData(data);
        expect(result.edges).toHaveLength(1);
        expect(result.edges[0].source).toBe('actor-1');
        expect(result.edges[0].target).toBe('node-1');
        expect(result.edges[0].data['relationship-type']).toEqual({ interacts: { actor: 'actor-1', nodes: ['node-1'] } });
    });

    it('gives an interacts edge no label of its own when the relationship has no description', () => {
        const data: CalmArchitectureSchema = {
            nodes: [
                { 'unique-id': 'actor-1', name: 'User', description: 'A user', 'node-type': 'actor' },
                { 'unique-id': 'node-1', name: 'Service A', description: 'A service', 'node-type': 'service' },
            ],
            relationships: [
                {
                    'unique-id': 'rel-1',
                    'relationship-type': { interacts: { actor: 'actor-1', nodes: ['node-1'] } },
                },
            ],
        };

        const result = parseCALMData(data);

        // A made-up "interacts" label would show as a permanent pill on every actor edge.
        expect(result.edges[0].data.description).toBe('');
    });

    it('keeps the description an author wrote on an interacts relationship', () => {
        const data: CalmArchitectureSchema = {
            nodes: [
                { 'unique-id': 'actor-1', name: 'User', description: 'A user', 'node-type': 'actor' },
                { 'unique-id': 'node-1', name: 'Service A', description: 'A service', 'node-type': 'service' },
            ],
            relationships: [
                {
                    'unique-id': 'rel-1',
                    description: 'uses',
                    'relationship-type': { interacts: { actor: 'actor-1', nodes: ['node-1'] } },
                },
            ],
        };

        expect(parseCALMData(data).edges[0].data.description).toBe('uses');
    });

    it('handles deployed-in relationships by setting parentId', () => {
        const data: CalmArchitectureSchema = {
            nodes: [
                { 'unique-id': 'container-1', name: 'Container', 'node-type': 'service' },
                { 'unique-id': 'node-1', name: 'Service A', 'node-type': 'service' },
            ],
            relationships: [
                {
                    'unique-id': 'rel-1',
                    'relationship-type': {
                        'deployed-in': {
                            container: 'container-1',
                            nodes: ['node-1'],
                        },
                    },
                },
            ],
        };
        const result = parseCALMData(data);
        // Container becomes a group node
        const containerNode = result.nodes.find((n) => n.id === 'container-1');
        expect(containerNode?.type).toBe('group');
        // Child node has parentId set
        const childNode = result.nodes.find((n) => n.id === 'node-1');
        expect(childNode?.parentId).toBe('container-1');
    });

    it('handles composed-of relationships by setting parentId', () => {
        const data: CalmArchitectureSchema = {
            nodes: [
                { 'unique-id': 'container-1', name: 'Container', 'node-type': 'service' },
                { 'unique-id': 'node-1', name: 'Service A', 'node-type': 'service' },
            ],
            relationships: [
                {
                    'unique-id': 'rel-1',
                    'relationship-type': {
                        'composed-of': {
                            container: 'container-1',
                            nodes: ['node-1'],
                        },
                    },
                },
            ],
        };
        const result = parseCALMData(data);
        const containerNode = result.nodes.find((n) => n.id === 'container-1');
        expect(containerNode?.type).toBe('group');
        const childNode = result.nodes.find((n) => n.id === 'node-1');
        expect(childNode?.parentId).toBe('container-1');
    });

    describe('nested composed-of containers (regression: finos/architecture-as-code#2567)', () => {
        // outer ⊃ inner ⊃ { leaf-1 → leaf-2 }. The connects edge forces the
        // inner container to be laid out wider than a standard node, so the
        // outer container must account for the inner container's true size.
        const nestedData: CalmArchitectureSchema = {
            nodes: [
                { 'unique-id': 'outer', name: 'Outer', 'node-type': 'system' },
                { 'unique-id': 'inner', name: 'Inner', 'node-type': 'system' },
                { 'unique-id': 'leaf-1', name: 'Leaf 1', 'node-type': 'service' },
                { 'unique-id': 'leaf-2', name: 'Leaf 2', 'node-type': 'service' },
            ],
            relationships: [
                {
                    'unique-id': 'rel-outer',
                    'relationship-type': { 'composed-of': { container: 'outer', nodes: ['inner'] } },
                },
                {
                    'unique-id': 'rel-inner',
                    'relationship-type': {
                        'composed-of': { container: 'inner', nodes: ['leaf-1', 'leaf-2'] },
                    },
                },
                {
                    'unique-id': 'rel-connects',
                    'relationship-type': {
                        connects: { source: { node: 'leaf-1' }, destination: { node: 'leaf-2' } },
                    },
                },
            ],
        };

        it('sizes the inner container wider than a standard node', () => {
            const { nodes } = parseCALMData(nestedData);
            const inner = nodes.find((n) => n.id === 'inner')!;
            expect(inner.width).toBeGreaterThan(GRAPH_LAYOUT.NODE_WIDTH);
        });

        it('fully encloses the inner container within the outer container', () => {
            const { nodes } = parseCALMData(nestedData);
            const outer = nodes.find((n) => n.id === 'outer')!;
            const inner = nodes.find((n) => n.id === 'inner')!;

            expect(outer.width).toBeDefined();
            expect(outer.height).toBeDefined();
            // The inner container (positioned relative to outer) must not
            // overflow the outer container's right or bottom edge.
            expect(inner.position.x).toBeGreaterThanOrEqual(0);
            expect(inner.position.y).toBeGreaterThanOrEqual(0);
            expect(inner.position.x + (inner.width as number)).toBeLessThanOrEqual(outer.width as number);
            expect(inner.position.y + (inner.height as number)).toBeLessThanOrEqual(outer.height as number);
        });

        it('encloses leaf nodes within the inner container', () => {
            const { nodes } = parseCALMData(nestedData);
            const inner = nodes.find((n) => n.id === 'inner')!;
            const leaves = nodes.filter((n) => n.parentId === 'inner');

            expect(leaves).toHaveLength(2);
            leaves.forEach((leaf) => {
                expect(leaf.position.x).toBeGreaterThanOrEqual(0);
                expect(leaf.position.y).toBeGreaterThanOrEqual(0);
                expect(leaf.position.x + GRAPH_LAYOUT.NODE_WIDTH).toBeLessThanOrEqual(inner.width as number);
                expect(leaf.position.y + GRAPH_LAYOUT.NODE_HEIGHT).toBeLessThanOrEqual(
                    inner.height as number
                );
            });
        });
    });

    it('does not create edges for deployed-in relationships', () => {
        const data: CalmArchitectureSchema = {
            nodes: [
                { 'unique-id': 'container-1', name: 'Container', 'node-type': 'service' },
                { 'unique-id': 'node-1', name: 'Service A', 'node-type': 'service' },
            ],
            relationships: [
                {
                    'unique-id': 'rel-1',
                    'relationship-type': {
                        'deployed-in': {
                            container: 'container-1',
                            nodes: ['node-1'],
                        },
                    },
                },
            ],
        };
        const result = parseCALMData(data);
        expect(result.edges).toHaveLength(0);
    });

    it('creates bidirectional edges for flows with both directions', () => {
        const data: CalmArchitectureSchema = {
            nodes: [
                { 'unique-id': 'node-1', name: 'Service A', 'node-type': 'service' },
                { 'unique-id': 'node-2', name: 'Service B', 'node-type': 'service' },
            ],
            relationships: [
                {
                    'unique-id': 'rel-1',
                    description: 'communicates',
                    'relationship-type': {
                        connects: {
                            source: { node: 'node-1' },
                            destination: { node: 'node-2' },
                        },
                    },
                },
            ],
            flows: [
                {
                    'unique-id': 'flow-1',
                    name: 'Request Flow',
                    transitions: [
                        {
                            'relationship-unique-id': 'rel-1',
                            'sequence-number': 1,
                            direction: 'source-to-destination',
                            description: 'request',
                        },
                        {
                            'relationship-unique-id': 'rel-1',
                            'sequence-number': 2,
                            direction: 'destination-to-source',
                            description: 'response',
                        },
                    ],
                },
            ],
        };
        const result = parseCALMData(data);
        // Should create two edges for bidirectional flow
        expect(result.edges).toHaveLength(2);
        const forwardEdge = result.edges.find((e) => e.id.includes('forward'));
        const backwardEdge = result.edges.find((e) => e.id.includes('backward'));
        expect(forwardEdge).toBeDefined();
        expect(backwardEdge).toBeDefined();
        expect(forwardEdge?.data.direction).toBe('forward');
        expect(backwardEdge?.data.direction).toBe('backward');
    });

    it('includes protocol in edge data', () => {
        const data: CalmArchitectureSchema = {
            nodes: [
                { 'unique-id': 'node-1', name: 'Service A', 'node-type': 'service' },
                { 'unique-id': 'node-2', name: 'Service B', 'node-type': 'service' },
            ],
            relationships: [
                {
                    'unique-id': 'rel-1',
                    description: 'HTTP call',
                    protocol: 'HTTPS',
                    'relationship-type': {
                        connects: {
                            source: { node: 'node-1' },
                            destination: { node: 'node-2' },
                        },
                    },
                },
            ],
        };
        const result = parseCALMData(data);
        expect(result.edges[0].data.protocol).toBe('HTTPS');
    });

    it('passes onShowDetails callback to node data', () => {
        const mockCallback = vi.fn();
        const data: CalmArchitectureSchema = {
            nodes: [
                { 'unique-id': 'node-1', name: 'Service A', 'node-type': 'service' },
            ],
        };
        const result = parseCALMData(data, mockCallback);
        expect(result.nodes[0].data.onShowDetails).toBe(mockCallback);
    });

    it('uses node name as label, falls back to id', () => {
        const data: CalmArchitectureSchema = {
            nodes: [
                { 'unique-id': 'node-1', name: 'Named Node', 'node-type': 'service' },
                { 'unique-id': 'node-2', 'node-type': 'service' },
            ],
        };
        const result = parseCALMData(data);
        expect(result.nodes.find((n) => n.id === 'node-1')?.data.label).toBe('Named Node');
        expect(result.nodes.find((n) => n.id === 'node-2')?.data.label).toBe('node-2');
    });

    it('handles interacts with multiple target nodes', () => {
        const data: CalmArchitectureSchema = {
            nodes: [
                { 'unique-id': 'actor-1', name: 'User', 'node-type': 'actor' },
                { 'unique-id': 'node-1', name: 'Service A', 'node-type': 'service' },
                { 'unique-id': 'node-2', name: 'Service B', 'node-type': 'service' },
            ],
            relationships: [
                {
                    'unique-id': 'rel-1',
                    description: 'uses',
                    'relationship-type': {
                        interacts: {
                            actor: 'actor-1',
                            nodes: ['node-1', 'node-2'],
                        },
                    },
                },
            ],
        };
        const result = parseCALMData(data);
        expect(result.edges).toHaveLength(2);
        expect(result.edges[0].target).toBe('node-1');
        expect(result.edges[1].target).toBe('node-2');
    });

    describe('nested container ordering', () => {
        // 4-level deployed-in stack A > B > C > system, with the nested containers
        // listed out of parent-first order (A, C, B, system) - the case that drops C.
        const data: CalmArchitectureSchema = {
            nodes: [
                { 'unique-id': 'A', name: 'A', 'node-type': 'system' },
                { 'unique-id': 'C', name: 'C', 'node-type': 'system' },
                { 'unique-id': 'B', name: 'B', 'node-type': 'system' },
                { 'unique-id': 'system', name: 'system', 'node-type': 'service' },
            ],
            relationships: [
                { 'unique-id': 'b-in-a', 'relationship-type': { 'deployed-in': { container: 'A', nodes: ['B'] } } },
                { 'unique-id': 'c-in-b', 'relationship-type': { 'deployed-in': { container: 'B', nodes: ['C'] } } },
                { 'unique-id': 's-in-c', 'relationship-type': { 'deployed-in': { container: 'C', nodes: ['system'] } } },
            ],
        };

        it('emits every parent before its children', () => {
            const order = parseCALMData(data).nodes.map((n) => n.id);
            const parentOf: Record<string, string> = { B: 'A', C: 'B', system: 'C' };
            for (const [child, parent] of Object.entries(parentOf)) {
                expect(order.indexOf(parent)).toBeLessThan(order.indexOf(child));
            }
        });

        it('keeps all four nodes (no container dropped)', () => {
            const ids = parseCALMData(data).nodes.map((n) => n.id).sort();
            expect(ids).toEqual(['A', 'B', 'C', 'system']);
        });
    });
});

describe('parseCALMData flow animation state', () => {
    it('drives active/visited styling from explicit flow-state, not opacity', () => {
        const data = {
            nodes: [
                { 'unique-id': 'a', name: 'A', 'node-type': 'service', 'flow-state': 'active', 'flow-opacity': 1 },
                { 'unique-id': 'b', name: 'B', 'node-type': 'service', 'flow-state': 'visited', 'flow-opacity': 0.85 },
                { 'unique-id': 'c', name: 'C', 'node-type': 'service', 'flow-state': 'in-flow', 'flow-opacity': 1 },
                { 'unique-id': 'd', name: 'D', 'node-type': 'service', 'flow-state': 'dimmed', 'flow-opacity': 0.1 },
            ],
        } as unknown as CalmArchitectureSchema;

        const byId = Object.fromEntries(parseCALMData(data).nodes.map((n) => [n.id, n]));

        expect(byId.a.className).toContain('flow-node-active');
        expect(byId.a.data.flowActive).toBe(true);
        expect(byId.b.className).toContain('flow-node-visited');
        expect(byId.b.data.flowVisited).toBe(true);

        // Regression: an in-flow node at full opacity must NOT be marked active.
        // Previously state was inferred from opacity === 1, so idle in-flow nodes pulsed.
        expect(byId.c.className ?? '').not.toContain('flow-node-active');
        expect(byId.c.data.flowActive).toBe(false);

        expect(byId.d.data.flowActive).toBe(false);
        expect(byId.d.data.flowVisited).toBe(false);
    });

    it('leaves elements untouched when no flow-state is present', () => {
        const data = {
            nodes: [{ 'unique-id': 'a', name: 'A', 'node-type': 'service' }],
        } as unknown as CalmArchitectureSchema;

        const [node] = parseCALMData(data).nodes;
        expect(node.data.flowActive).toBeUndefined();
        expect(node.className).toBeUndefined();
    });

    it('styles relationships when nodes have no flow-state', () => {
        const data = {
            nodes: [
                { 'unique-id': 'a', name: 'A', 'node-type': 'service' },
                { 'unique-id': 'b', name: 'B', 'node-type': 'service' },
            ],
            relationships: [{
                'unique-id': 'a-to-b',
                'flow-state': 'active',
                'relationship-type': { connects: { source: { node: 'a' }, destination: { node: 'b' } } },
            }],
        } as unknown as CalmArchitectureSchema;

        const [edge] = parseCALMData(data).edges;
        expect(edge.className).toBe('flow-edge-active');
        expect(edge.data.flowActive).toBe(true);
    });
});

describe('parseCALMData - nodes with several parents', () => {
    const node = (id: string) => ({ 'unique-id': id, name: id, 'node-type': 'service' });
    const deployedIn = (id: string, container: string, nodes: string[]) =>
        ({ 'unique-id': id, 'relationship-type': { 'deployed-in': { container, nodes } } });
    const connects = (id: string, source: string, destination: string) =>
        ({ 'unique-id': id, 'relationship-type': { connects: { source: { node: source }, destination: { node: destination } } } });
    const drawings = (result: { nodes: { id: string; parentId?: string; data: Record<string, unknown> }[] }, calmId: string) =>
        result.nodes.filter((n) => n.data['unique-id'] === calmId).map((n) => [n.id, n.parentId]);
    const sharedNamespace = (extra: object[] = [], extraNodes: string[] = []) => ({
        nodes: ['cluster-a', 'cluster-b', 'ns', 'svc', 'db', ...extraNodes].map(node),
        relationships: [
            deployedIn('r1', 'cluster-a', ['ns']),
            deployedIn('r2', 'cluster-b', ['ns']),
            deployedIn('r3', 'ns', ['svc', 'db']),
            ...extra,
        ],
    }) as CalmArchitectureSchema;

    it('draws a node once in each parent, and keeps the CALM id in the last parent as before', () => {
        const result = parseCALMData(sharedNamespace());
        expect(drawings(result, 'ns')).toEqual([
            ['ns', 'cluster-b'],
            ['ns__in__cluster-a', 'cluster-a'],
        ]);
    });

    it('connects only the copy inside a container to that container', () => {
        const result = parseCALMData(sharedNamespace([connects('c1', 'svc', 'cluster-a')]));
        expect(result.edges.map((e) => [e.source, e.target])).toEqual([
            ['svc__in__ns__in__cluster-a', 'cluster-a'],
        ]);
    });

    it('copies everything nested in a shared container', () => {
        const result = parseCALMData(sharedNamespace());
        expect(result.nodes.find((n) => n.id === 'ns__in__cluster-a')?.type).toBe('group');
        expect(drawings(result, 'svc')).toEqual([
            ['svc', 'ns'],
            ['svc__in__ns__in__cluster-a', 'ns__in__cluster-a'],
        ]);
    });

    it('keeps the CALM node in the data of each copy', () => {
        const result = parseCALMData(sharedNamespace());
        const copy = result.nodes.find((n) => n.id === 'svc__in__ns__in__cluster-a');
        expect(copy?.data).toEqual(expect.objectContaining({ 'unique-id': 'svc', label: 'svc' }));
    });

    it('connects the copies in the same container', () => {
        const result = parseCALMData(sharedNamespace([connects('c1', 'svc', 'db')]));
        expect(result.edges.map((e) => [e.source, e.target])).toEqual([
            ['svc', 'db'],
            ['svc__in__ns__in__cluster-a', 'db__in__ns__in__cluster-a'],
        ]);
        expect(new Set(result.edges.map((e) => e.id)).size).toBe(2);
    });

    it('connects a node drawn once to every copy', () => {
        const result = parseCALMData(sharedNamespace([connects('c1', 'client', 'svc')], ['client']));
        expect(result.edges.map((e) => [e.source, e.target])).toEqual([
            ['client', 'svc'],
            ['client', 'svc__in__ns__in__cluster-a'],
        ]);
    });

    it('keeps the CALM id in the container of the last relationship when a container repeats', () => {
        const result = parseCALMData({
            nodes: ['A', 'B', 'N'].map(node),
            relationships: [deployedIn('r1', 'A', ['N']), deployedIn('r2', 'B', ['N']), deployedIn('r3', 'A', ['N'])],
        } as CalmArchitectureSchema);
        expect(drawings(result, 'N')).toEqual([['N', 'A'], ['N__in__B', 'B']]);
    });

    it('breaks a cycle as before, whatever the node order', () => {
        const relationships = [deployedIn('r1', 'B', ['A']), deployedIn('r2', 'C', ['A']), deployedIn('r3', 'A', ['B'])];
        for (const order of [['A', 'B', 'C'], ['B', 'A', 'C']]) {
            const result = parseCALMData({ nodes: order.map(node), relationships } as CalmArchitectureSchema);
            expect(result.nodes.map((n) => [n.id, n.parentId]).sort()).toEqual([['A', 'C'], ['B', 'A'], ['C', undefined]]);
        }
    });

    it('keeps the parents main gave when a cycle is undone by a later relationship', () => {
        const result = parseCALMData({
            nodes: ['a', 'b', 'c'].map(node),
            relationships: [deployedIn('r1', 'a', ['b']), deployedIn('r2', 'b', ['a']), deployedIn('r3', 'c', ['b'])],
        } as CalmArchitectureSchema);
        expect(result.nodes.map((n) => [n.id, n.parentId]).sort()).toEqual([['a', 'b'], ['b', 'c'], ['c', undefined]]);
    });

    it('draws a node once when it is listed in both a container and a container inside it', () => {
        const result = parseCALMData({
            nodes: ['cluster', 'ns', 'svc'].map(node),
            relationships: [deployedIn('r1', 'cluster', ['ns', 'svc']), deployedIn('r2', 'ns', ['svc'])],
        } as CalmArchitectureSchema);
        expect(drawings(result, 'svc')).toEqual([['svc', 'ns']]);
    });

    it('connects only the copies that share a container', () => {
        const result = parseCALMData({
            nodes: ['a', 'b', 'c', 'ns', 'svc', 'q'].map(node),
            relationships: [
                deployedIn('r1', 'a', ['ns', 'q']),
                deployedIn('r2', 'b', ['ns']),
                deployedIn('r3', 'ns', ['svc']),
                deployedIn('r4', 'c', ['q']),
                connects('c1', 'svc', 'q'),
            ],
        } as CalmArchitectureSchema);
        expect(result.edges.map((e) => [e.source, e.target])).toEqual([['svc__in__ns__in__a', 'q__in__a']]);
    });

    it('connects only the copies that share the most containers', () => {
        const result = parseCALMData({
            nodes: ['ca', 'cb', 'ns1', 'ns2', 's', 't'].map(node),
            relationships: [
                deployedIn('r1', 'ca', ['ns1', 'ns2']),
                deployedIn('r2', 'ns1', ['s', 't']),
                deployedIn('r3', 'ns2', ['t']),
                deployedIn('r4', 'cb', ['s']),
                connects('c1', 's', 't'),
            ],
        } as CalmArchitectureSchema);
        expect(result.edges.map((e) => [e.source, e.target])).toEqual([['s__in__ns1', 't__in__ns1']]);
    });

    it('does not apply the limit to a large diagram with few copies', () => {
        const chain = Array.from({ length: 1002 }, (_, k) => `n${k}`);
        const result = parseCALMData({
            nodes: ['ca', 'cb', 'svc', ...chain].map(node),
            relationships: [
                deployedIn('r1', 'ca', ['svc']),
                deployedIn('r2', 'cb', ['svc']),
                ...chain.slice(1).map((id, k) => connects(`c${k}`, chain[k], id)),
            ],
        } as CalmArchitectureSchema);
        expect(result.copiesLimited).toBe(false);
        expect(drawings(result, 'svc')).toHaveLength(2);
    });

    it('gives each drawing one edge when copies of both ends tie on shared containers', () => {
        const ps = ['P0', 'P1', 'P2'];
        const qs = ['Q0', 'Q1', 'Q2'];
        const result = parseCALMData({
            nodes: ['X', 'Z', 'W', ...ps, ...qs, 's', 't'].map(node),
            relationships: [
                deployedIn('rx', 'X', [...ps, ...qs]),
                ...ps.map((p) => deployedIn(`in-${p}`, p, ['s'])),
                deployedIn('in-Z', 'Z', ['s']),
                ...qs.map((q) => deployedIn(`in-${q}`, q, ['t'])),
                deployedIn('in-W', 'W', ['t']),
                connects('c1', 's', 't'),
            ],
        } as CalmArchitectureSchema);
        expect(result.edges.length).toBeLessThan(8);
    });

    it('connects a container to the copy of its member inside each of its drawings', () => {
        const result = parseCALMData(sharedNamespace([connects('c1', 'ns', 'svc')]));
        expect(result.edges.map((e) => [e.source, e.target])).toEqual([
            ['ns', 'svc'],
            ['ns__in__cluster-a', 'svc__in__ns__in__cluster-a'],
        ]);
    });

    it('expands an interacts relationship to every copy', () => {
        const interacts = { 'unique-id': 'i1', 'relationship-type': { interacts: { actor: 'user', nodes: ['svc'] } } };
        const result = parseCALMData(sharedNamespace([interacts], ['user']));
        expect(result.edges.map((e) => e.target)).toEqual(['svc', 'svc__in__ns__in__cluster-a']);
    });

    it('draws a loop on each copy for a relationship from a node to itself', () => {
        const result = parseCALMData(sharedNamespace([connects('c1', 'svc', 'svc')]));
        expect(result.edges.map((e) => [e.source, e.target])).toEqual([
            ['svc', 'svc'],
            ['svc__in__ns__in__cluster-a', 'svc__in__ns__in__cluster-a'],
        ]);
    });

    it('draws one edge when only a container around everything holds copies of both ends', () => {
        const result = parseCALMData({
            nodes: ['prod', 'c1', 'c2', 'c3', 'c4', 'a', 'b'].map(node),
            relationships: [
                deployedIn('r1', 'prod', ['c1', 'c2', 'c3', 'c4']),
                deployedIn('r2', 'c1', ['a']),
                deployedIn('r3', 'c2', ['a']),
                deployedIn('r4', 'c3', ['b']),
                deployedIn('r5', 'c4', ['b']),
                connects('c1x', 'a', 'b'),
            ],
        } as CalmArchitectureSchema);
        expect(result.edges).toHaveLength(1);
    });

    it('ignores a container that is not a node before it chooses containers', () => {
        const relationships = [deployedIn('r1', 'c', ['a']), deployedIn('r2', 'a', ['b']), deployedIn('r3', 'X', ['b']), deployedIn('r4', 'b', ['a'])];
        const result = parseCALMData({ nodes: ['a', 'b', 'c'].map(node), relationships } as CalmArchitectureSchema);
        const withoutX = parseCALMData({ nodes: ['a', 'b', 'c'].map(node), relationships: relationships.filter((r) => r['unique-id'] !== 'r3') } as CalmArchitectureSchema);
        expect(result.nodes.map((n) => [n.id, n.parentId])).toEqual(withoutX.nodes.map((n) => [n.id, n.parentId]));
    });

    it('lists a parent once when relationships repeat it', () => {
        const result = parseCALMData(sharedNamespace([deployedIn('r4', 'cluster-a', ['ns'])]));
        expect(drawings(result, 'ns')).toHaveLength(2);
    });

    it('does not give a copy the id of a real node', () => {
        const result = parseCALMData(sharedNamespace([], ['ns__in__cluster-a']));
        const ids = result.nodes.map((n) => n.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('ignores a node listed as its own container', () => {
        const result = parseCALMData({
            nodes: [node('a'), node('b')],
            relationships: [deployedIn('r1', 'a', ['a', 'b'])],
        } as CalmArchitectureSchema);
        expect(result.nodes.map((n) => [n.id, n.parentId]).sort()).toEqual([['a', undefined], ['b', 'a']]);
    });

    it('draws each node once when copies would exceed the limit', () => {
        // Each level has two containers that are both in both containers of the level above
        const levels = 12;
        const ids = Array.from({ length: levels }, (_, k) => [`l${k}a`, `l${k}b`]);
        const relationships = ids.slice(1).flatMap(([a, b], k) => [
            deployedIn(`r${k}a`, ids[k][0], [a, b]),
            deployedIn(`r${k}b`, ids[k][1], [a, b]),
        ]);
        const result = parseCALMData({ nodes: ids.flat().map(node), relationships } as CalmArchitectureSchema);
        expect(result.nodes).toHaveLength(levels * 2);
        expect(result.nodes.find((n) => n.id === 'l11a')?.parentId).toBe('l10b');
        expect(result.copiesLimited).toBe(true);
    });

    it('draws each node once when the edges to copies would exceed the limit', () => {
        const containers = Array.from({ length: 40 }, (_, k) => `c${k}`);
        const clients = Array.from({ length: 30 }, (_, k) => `client${k}`);
        const result = parseCALMData({
            nodes: [...containers, ...clients, 'svc'].map(node),
            relationships: [
                ...containers.map((c) => deployedIn(`in-${c}`, c, ['svc'])),
                ...clients.map((c) => connects(`${c}-svc`, c, 'svc')),
            ],
        } as CalmArchitectureSchema);
        expect(drawings(result, 'svc')).toEqual([['svc', 'c39']]);
        expect(result.edges).toHaveLength(30);
        expect(result.copiesLimited).toBe(true);
    });

    it('does not mark a diagram under the limits as limited', () => {
        expect(parseCALMData(sharedNamespace()).copiesLimited).toBe(false);
    });

    it('counts only copies against the limit, not every node', () => {
        const singles = Array.from({ length: 1001 }, (_, k) => node(`n${k}`));
        const result = parseCALMData({
            nodes: [node('cluster-a'), node('cluster-b'), node('ns'), ...singles],
            relationships: [deployedIn('r1', 'cluster-a', ['ns']), deployedIn('r2', 'cluster-b', ['ns'])],
        } as CalmArchitectureSchema);
        expect(result.nodes.filter((n) => n.data['unique-id'] === 'ns')).toHaveLength(2);
    });

    it('stops at a containment cycle', () => {
        const result = parseCALMData({
            nodes: [node('a'), node('b')],
            relationships: [deployedIn('r1', 'a', ['b']), deployedIn('r2', 'b', ['a'])],
        } as CalmArchitectureSchema);
        expect(result.nodes.map((n) => n.data['unique-id']).sort()).toEqual(['a', 'b']);
    });
});

