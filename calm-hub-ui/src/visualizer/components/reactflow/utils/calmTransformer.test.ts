import { describe, it, expect, vi } from 'vitest';
import { parseCALMData, expandOptionsRelationships } from './calmTransformer';
import { CalmArchitectureSchema } from '../../../../../../calm-models/src/types/core-types.js';

describe('expandOptionsRelationships', () => {
    it('returns unchanged data when data is null', () => {
        const result = expandOptionsRelationships(null as unknown as CalmArchitectureSchema);
        expect(result).toBeNull();
    });

    it('returns unchanged data when no relationships', () => {
        const data: CalmArchitectureSchema = {
            nodes: [{ 'unique-id': 'node-1', name: 'Node 1', 'node-type': 'service' }],
        };
        const result = expandOptionsRelationships(data);
        expect(result).toEqual(data);
    });

    it('returns unchanged data when no options relationships', () => {
        const data: CalmArchitectureSchema = {
            nodes: [
                { 'unique-id': 'node-1', name: 'Node 1', 'node-type': 'service' },
                { 'unique-id': 'node-2', name: 'Node 2', 'node-type': 'service' },
            ],
            relationships: [
                {
                    'unique-id': 'rel-1',
                    'relationship-type': {
                        connects: {
                            source: { node: 'node-1' },
                            destination: { node: 'node-2' },
                        },
                    },
                },
            ],
        };
        const result = expandOptionsRelationships(data);
        expect(result.relationships).toHaveLength(1);
        expect(result.nodes).toHaveLength(2);
    });
});

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

    it('creates system nodes for system type', () => {
        const data: CalmArchitectureSchema = {
            nodes: [
                { 'unique-id': 'system-1', name: 'My System', 'node-type': 'system' },
            ],
        };
        const result = parseCALMData(data);
        expect(result.nodes).toHaveLength(1);
        expect(result.nodes[0].type).toBe('group');
        expect(result.nodes[0].data.nodeType).toBe('system');
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
        expect(result.edges[0].data.relationshipType).toBe('interacts');
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
});
