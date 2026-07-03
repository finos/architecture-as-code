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
        // listed out of parent-first order (A, C, B, system) — the case that drops C.
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
