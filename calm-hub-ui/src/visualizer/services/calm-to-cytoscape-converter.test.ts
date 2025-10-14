import { describe, it, expect } from 'vitest';
import { CalmArchitectureSchema, CalmInterfaceSchema, CalmNodeSchema, CalmRelationshipSchema } from '../../../../calm-models/src/types/core-types.js';
import {
    convertCalmToCytoscape,
    convertCalmNodesToCytoscapeNodes,
    convertCalmRelationshipsToEdges,
} from './calm-to-cytoscape-converter.js';
import { CalmControlsSchema } from '../../../../calm-models/src/types/control-types.js';

function createCalmNode(id: string, name: string, nodeType: string, description = ''): CalmNodeSchema {
    return {
        'unique-id': id,
        name,
        'node-type': nodeType,
        description,
    } as CalmNodeSchema;
}

function createComposedOfRelationship(
    id: string,
    container: string,
    nodes: string[],
    description = ''
): CalmRelationshipSchema {
    return {
        'unique-id': id,
        description,
        'relationship-type': {
            'composed-of': {
                container,
                nodes,
            },
        },
    } as CalmRelationshipSchema;
}

function createDeployedInRelationship(
    id: string,
    container: string,
    nodes: string[],
    description = ''
): CalmRelationshipSchema {
    return {
        'unique-id': id,
        description,
        'relationship-type': {
            'deployed-in': {
                container,
                nodes,
            },
        },
    } as CalmRelationshipSchema;
}

function createInteractsRelationship(
    id: string,
    actor: string,
    nodes: string[],
    description = ''
): CalmRelationshipSchema {
    return {
        'unique-id': id,
        description,
        'relationship-type': {
            interacts: {
                actor,
                nodes,
            },
        },
    } as CalmRelationshipSchema;
}

function createConnectsRelationship(
    id: string,
    sourceNode: string,
    targetNode: string,
    description = ''
): CalmRelationshipSchema {
    return {
        'unique-id': id,
        description,
        'relationship-type': {
            connects: {
                source: { node: sourceNode },
                destination: { node: targetNode },
            },
        },
    } as CalmRelationshipSchema;
}

describe('convertCalmToCytoscape', () => {
    describe('Main Converter', () => {
        it('should return empty arrays when calmInstance is undefined', () => {
            const result = convertCalmToCytoscape(undefined);

            expect(result).toEqual({ nodes: [], edges: [] });
        });

        it('should return empty arrays when calmInstance has no nodes or relationships', () => {
            const calmInstance: CalmArchitectureSchema = {} as CalmArchitectureSchema;

            const result = convertCalmToCytoscape(calmInstance);

            expect(result).toEqual({ nodes: [], edges: [] });
        });

        it('should convert a simple CALM instance with nodes and edges', () => {
            const calmInstance: CalmArchitectureSchema = {
                nodes: [
                    createCalmNode('node1', 'Service A', 'service', 'Main service'),
                    createCalmNode('node2', 'Database', 'database', 'Data storage'),
                ],
                relationships: [
                    createConnectsRelationship('rel1', 'node1', 'node2', 'Reads from'),
                ],
            } as CalmArchitectureSchema;

            const result = convertCalmToCytoscape(calmInstance);

            expect(result.nodes).toHaveLength(2);
            expect(result.edges).toHaveLength(1);
            expect(result.nodes[0].data.id).toBe('node1');
            expect(result.nodes[1].data.id).toBe('node2');
            expect(result.edges[0].data.source).toBe('node1');
            expect(result.edges[0].data.target).toBe('node2');
        });
    });

    describe('Node Conversion', () => {
        it('should convert basic node properties correctly', () => {
            const calmInstance: CalmArchitectureSchema = {
                nodes: [createCalmNode('node1', 'Service A', 'service', 'Main service')],
                relationships: [],
            } as CalmArchitectureSchema;

            const result = convertCalmNodesToCytoscapeNodes(calmInstance);

            expect(result).toHaveLength(1);
            expect(result[0].data.id).toBe('node1');
            expect(result[0].data.name).toBe('Service A');
            expect(result[0].data.type).toBe('service');
            expect(result[0].data.description).toBe('Main service');
            expect(result[0].classes).toBe('node');
        });

        it('should generate labels with and without descriptions', () => {
            const calmInstance: CalmArchitectureSchema = {
                nodes: [createCalmNode('node1', 'Service A', 'service', 'Main service')],
                relationships: [],
            } as CalmArchitectureSchema;

            const result = convertCalmNodesToCytoscapeNodes(calmInstance);

            expect(result[0].data.cytoscapeProps.labelWithoutDescription).toBe('Service A\n[service]');
            expect(result[0].data.cytoscapeProps.labelWithDescription).toBe('Service A\n[service]\n\nMain service\n');
        });

        it('should mark container nodes as groups in composed-of relationships', () => {
            const calmInstance: CalmArchitectureSchema = {
                nodes: [
                    createCalmNode('container1', 'Container', 'system'),
                    createCalmNode('node1', 'Child Node', 'service'),
                ],
                relationships: [createComposedOfRelationship('rel1', 'container1', ['node1'])],
            } as CalmArchitectureSchema;

            const result = convertCalmNodesToCytoscapeNodes(calmInstance);

            const container = result.find((n) => n.data.id === 'container1');
            const child = result.find((n) => n.data.id === 'node1');

            expect(container?.classes).toBe('group');
            expect(child?.classes).toBe('node');
        });

        it('should mark container nodes as groups in deployed-in relationships', () => {
            const calmInstance: CalmArchitectureSchema = {
                nodes: [
                    createCalmNode('environment1', 'Production', 'environment'),
                    createCalmNode('service1', 'API Service', 'service'),
                ],
                relationships: [createDeployedInRelationship('rel1', 'environment1', ['service1'])],
            } as CalmArchitectureSchema;

            const result = convertCalmNodesToCytoscapeNodes(calmInstance);

            const container = result.find((n) => n.data.id === 'environment1');
            const child = result.find((n) => n.data.id === 'service1');

            expect(container?.classes).toBe('group');
            expect(child?.classes).toBe('node');
        });

        it('should set parent for child nodes in composed-of relationships', () => {
            const calmInstance: CalmArchitectureSchema = {
                nodes: [
                    createCalmNode('container1', 'Container', 'system'),
                    createCalmNode('node1', 'Child Node', 'service'),
                ],
                relationships: [createComposedOfRelationship('rel1', 'container1', ['node1'])],
            } as CalmArchitectureSchema;

            const result = convertCalmNodesToCytoscapeNodes(calmInstance);

            const child = result.find((n) => n.data.id === 'node1');

            expect(child?.data.parent).toBe('container1');
        });

        it('should set parent for child nodes in deployed-in relationships', () => {
            const calmInstance: CalmArchitectureSchema = {
                nodes: [
                    createCalmNode('environment1', 'Production', 'environment'),
                    createCalmNode('service1', 'API Service', 'service'),
                ],
                relationships: [createDeployedInRelationship('rel1', 'environment1', ['service1'])],
            } as CalmArchitectureSchema;

            const result = convertCalmNodesToCytoscapeNodes(calmInstance);

            const child = result.find((n) => n.data.id === 'service1');

            expect(child?.data.parent).toBe('environment1');
        });

        it('should handle multiple children in hierarchical relationships', () => {
            const calmInstance: CalmArchitectureSchema = {
                nodes: [
                    createCalmNode('container1', 'Container', 'system'),
                    createCalmNode('node1', 'Child 1', 'service'),
                    createCalmNode('node2', 'Child 2', 'service'),
                    createCalmNode('node3', 'Child 3', 'service'),
                ],
                relationships: [createComposedOfRelationship('rel1', 'container1', ['node1', 'node2', 'node3'])],
            } as CalmArchitectureSchema;

            const result = convertCalmNodesToCytoscapeNodes(calmInstance);

            const children = result.filter((n) => n.data.parent === 'container1');

            expect(children).toHaveLength(3);
            expect(children.map((c) => c.data.id)).toEqual(['node1', 'node2', 'node3']);
        });

        it('should prioritize composed-of over deployed-in when both exist', () => {
            const calmInstance: CalmArchitectureSchema = {
                nodes: [
                    createCalmNode('container1', 'Logical Container', 'system'),
                    createCalmNode('environment1', 'Environment', 'environment'),
                    createCalmNode('service1', 'Service', 'service'),
                ],
                relationships: [
                    createComposedOfRelationship('rel1', 'container1', ['service1']),
                    createDeployedInRelationship('rel2', 'environment1', ['service1']),
                ],
            } as CalmArchitectureSchema;

            const result = convertCalmNodesToCytoscapeNodes(calmInstance);

            const service = result.find((n) => n.data.id === 'service1');

            expect(service?.data.parent).toBe('container1');
        });

        it('should preserve interfaces and controls if present', () => {
            const nodeWithExtras = createCalmNode('node1', 'Service', 'service');
            nodeWithExtras.interfaces = [{ 'unique-id': 'int1' } as CalmInterfaceSchema];
            nodeWithExtras.controls = { 'control-1': {} } as unknown as CalmControlsSchema;

            const calmInstance: CalmArchitectureSchema = {
                nodes: [nodeWithExtras],
                relationships: [],
            } as CalmArchitectureSchema;

            const result = convertCalmNodesToCytoscapeNodes(calmInstance);

            expect(result[0].data.interfaces).toBeDefined();
            expect(result[0].data.controls).toBeDefined();
        });

        it('should handle nodes without parent relationships', () => {
            const calmInstance: CalmArchitectureSchema = {
                nodes: [
                    createCalmNode('node1', 'Standalone', 'service'),
                    createCalmNode('node2', 'Another', 'service'),
                ],
                relationships: [],
            } as CalmArchitectureSchema;

            const result = convertCalmNodesToCytoscapeNodes(calmInstance);

            expect(result[0].data.parent).toBeUndefined();
            expect(result[1].data.parent).toBeUndefined();
            expect(result[0].classes).toBe('node');
            expect(result[1].classes).toBe('node');
        });
    });

    describe('Edge Conversion', () => {
        it('should convert interacts relationships to edges', () => {
            const calmInstance: CalmArchitectureSchema = {
                nodes: [
                    createCalmNode('user1', 'User', 'actor'),
                    createCalmNode('service1', 'Service', 'service'),
                ],
                relationships: [createInteractsRelationship('rel1', 'user1', ['service1'], 'Uses')],
            } as CalmArchitectureSchema;

            const result = convertCalmRelationshipsToEdges(calmInstance);

            expect(result).toHaveLength(1);
            expect(result[0].data.id).toBe('rel1');
            expect(result[0].data.source).toBe('user1');
            expect(result[0].data.target).toBe('service1');
            expect(result[0].data.label).toBe('Uses');
        });

        it('should convert connects relationships to edges', () => {
            const calmInstance: CalmArchitectureSchema = {
                nodes: [
                    createCalmNode('service1', 'Service A', 'service'),
                    createCalmNode('service2', 'Service B', 'service'),
                ],
                relationships: [createConnectsRelationship('rel1', 'service1', 'service2', 'Sends data to')],
            } as CalmArchitectureSchema;

            const result = convertCalmRelationshipsToEdges(calmInstance);

            expect(result).toHaveLength(1);
            expect(result[0].data.id).toBe('rel1');
            expect(result[0].data.source).toBe('service1');
            expect(result[0].data.target).toBe('service2');
            expect(result[0].data.label).toBe('Sends data to');
        });

        it('should filter out composed-of relationships', () => {
            const calmInstance: CalmArchitectureSchema = {
                nodes: [
                    createCalmNode('container1', 'Container', 'system'),
                    createCalmNode('node1', 'Child', 'service'),
                ],
                relationships: [
                    createComposedOfRelationship('rel1', 'container1', ['node1']),
                    createConnectsRelationship('rel2', 'container1', 'node1'),
                ],
            } as CalmArchitectureSchema;

            const result = convertCalmRelationshipsToEdges(calmInstance);

            expect(result).toHaveLength(1);
            expect(result[0].data.id).toBe('rel2');
        });

        it('should filter out deployed-in relationships', () => {
            const calmInstance: CalmArchitectureSchema = {
                nodes: [
                    createCalmNode('environment1', 'Environment', 'environment'),
                    createCalmNode('service1', 'Service', 'service'),
                ],
                relationships: [
                    createDeployedInRelationship('rel1', 'environment1', ['service1']),
                    createConnectsRelationship('rel2', 'environment1', 'service1'),
                ],
            } as CalmArchitectureSchema;

            const result = convertCalmRelationshipsToEdges(calmInstance);

            expect(result).toHaveLength(1);
            expect(result[0].data.id).toBe('rel2');
        });

        it('should handle empty description in relationships', () => {
            const calmInstance: CalmArchitectureSchema = {
                nodes: [createCalmNode('node1', 'A', 'service'), createCalmNode('node2', 'B', 'service')],
                relationships: [createConnectsRelationship('rel1', 'node1', 'node2', '')],
            } as CalmArchitectureSchema;

            const result = convertCalmRelationshipsToEdges(calmInstance);

            expect(result[0].data.label).toBe('');
        });

        it('should handle multiple relationship types together', () => {
            const calmInstance: CalmArchitectureSchema = {
                nodes: [
                    createCalmNode('user1', 'User', 'actor'),
                    createCalmNode('service1', 'Service A', 'service'),
                    createCalmNode('service2', 'Service B', 'service'),
                ],
                relationships: [
                    createInteractsRelationship('rel1', 'user1', ['service1']),
                    createConnectsRelationship('rel2', 'service1', 'service2'),
                ],
            } as CalmArchitectureSchema;

            const result = convertCalmRelationshipsToEdges(calmInstance);

            expect(result).toHaveLength(2);
            expect(result.map((e) => e.data.id)).toEqual(['rel1', 'rel2']);
        });

        it('should return empty array when no relationships exist', () => {
            const calmInstance: CalmArchitectureSchema = {
                nodes: [createCalmNode('node1', 'Service', 'service')],
                relationships: [],
            } as CalmArchitectureSchema;

            const result = convertCalmRelationshipsToEdges(calmInstance);

            expect(result).toEqual([]);
        });

        it('should handle invalid interacts relationships gracefully', () => {
            const invalidRelationship: CalmRelationshipSchema = {
                'unique-id': 'rel1',
                'relationship-type': {
                    interacts: {
                        actor: 'user1',
                        nodes: [], // Empty nodes array
                    },
                },
            } as CalmRelationshipSchema;

            const calmInstance: CalmArchitectureSchema = {
                nodes: [],
                relationships: [invalidRelationship],
            } as CalmArchitectureSchema;

            const result = convertCalmRelationshipsToEdges(calmInstance);

            expect(result).toEqual([]);
        });

        it('should handle invalid connects relationships gracefully', () => {
            const invalidRelationship: CalmRelationshipSchema = {
                'unique-id': 'rel1',
                'relationship-type': {
                    connects: {
                        source: {},
                        destination: {},
                    },
                },
            } as CalmRelationshipSchema;

            const calmInstance: CalmArchitectureSchema = {
                nodes: [],
                relationships: [invalidRelationship],
            } as CalmArchitectureSchema;

            const result = convertCalmRelationshipsToEdges(calmInstance);

            expect(result).toEqual([]);
        });
    });

    describe('Complex Scenarios', () => {
        it('should handle nested hierarchies correctly', () => {
            const calmInstance: CalmArchitectureSchema = {
                nodes: [
                    createCalmNode('system1', 'System', 'system'),
                    createCalmNode('subsystem1', 'Subsystem', 'system'),
                    createCalmNode('service1', 'Service', 'service'),
                ],
                relationships: [
                    createComposedOfRelationship('rel1', 'system1', ['subsystem1']),
                    createComposedOfRelationship('rel2', 'subsystem1', ['service1']),
                ],
            } as CalmArchitectureSchema;

            const result = convertCalmNodesToCytoscapeNodes(calmInstance);

            const system = result.find((n) => n.data.id === 'system1');
            const subsystem = result.find((n) => n.data.id === 'subsystem1');
            const service = result.find((n) => n.data.id === 'service1');

            expect(system?.classes).toBe('group');
            expect(subsystem?.classes).toBe('group');
            expect(service?.classes).toBe('node');

            expect(subsystem?.data.parent).toBe('system1');
            expect(service?.data.parent).toBe('subsystem1');
        });

        it('should handle a complete architecture with mixed relationships', () => {
            const calmInstance: CalmArchitectureSchema = {
                nodes: [
                    createCalmNode('user1', 'User', 'actor'),
                    createCalmNode('system1', 'Main System', 'system'),
                    createCalmNode('service1', 'API Service', 'service'),
                    createCalmNode('db1', 'Database', 'database'),
                ],
                relationships: [
                    createComposedOfRelationship('rel1', 'system1', ['service1', 'db1']),
                    createInteractsRelationship('rel2', 'user1', ['service1']),
                    createConnectsRelationship('rel3', 'service1', 'db1'),
                ],
            } as CalmArchitectureSchema;

            const { nodes, edges } = convertCalmToCytoscape(calmInstance);

            expect(nodes).toHaveLength(4);
            expect(edges).toHaveLength(2);

            const system = nodes.find((n) => n.data.id === 'system1');
            expect(system?.classes).toBe('group');

            const edgeIds = edges.map((e) => e.data.id);
            expect(edgeIds).toContain('rel2');
            expect(edgeIds).toContain('rel3');
            expect(edgeIds).not.toContain('rel1');
        });
    });
});
