import { describe, it, expect } from 'vitest';
import { parsePatternData } from './patternTransformer';

// Helper to build a minimal pattern node schema item
function schemaNode(
    uniqueId: string,
    name: string,
    nodeType: string,
    extras?: Record<string, unknown>
) {
    return {
        properties: {
            'unique-id': { const: uniqueId },
            name: { const: name },
            'node-type': { const: nodeType },
            ...extras,
        },
    };
}

// Helper to build a connects relationship schema item
function connectsRelationship(
    uniqueId: string,
    source: string,
    destination: string,
    extras?: Record<string, unknown>
) {
    return {
        properties: {
            'unique-id': { const: uniqueId },
            description: { const: `${source} to ${destination}` },
            'relationship-type': {
                const: {
                    connects: {
                        source: { node: source },
                        destination: { node: destination },
                    },
                },
            },
            ...extras,
        },
    };
}

// Helper to wrap prefixItems into a pattern
function makePattern(
    nodes: unknown[],
    relationships: unknown[] = []
) {
    return {
        properties: {
            nodes: { prefixItems: nodes },
            relationships: { prefixItems: relationships },
        },
    };
}

describe('parsePatternData', () => {
    it('returns empty arrays for null data', () => {
        const result = parsePatternData(null as unknown as Record<string, unknown>);
        expect(result.nodes).toEqual([]);
        expect(result.edges).toEqual([]);
    });

    it('returns empty arrays for undefined data', () => {
        const result = parsePatternData(undefined as unknown as Record<string, unknown>);
        expect(result.nodes).toEqual([]);
        expect(result.edges).toEqual([]);
    });

    it('returns empty arrays for empty object', () => {
        const result = parsePatternData({});
        expect(result.nodes).toEqual([]);
        expect(result.edges).toEqual([]);
    });

    it('creates nodes from a basic pattern', () => {
        const pattern = makePattern([
            schemaNode('svc-a', 'Service A', 'service'),
            schemaNode('db-b', 'Database B', 'database'),
        ]);
        const result = parsePatternData(pattern);
        expect(result.nodes).toHaveLength(2);
        expect(result.nodes.find((n) => n.id === 'svc-a')).toBeDefined();
        expect(result.nodes.find((n) => n.id === 'db-b')).toBeDefined();
        expect(result.nodes.find((n) => n.id === 'svc-a')?.data.label).toBe('Service A');
        expect(result.nodes.find((n) => n.id === 'svc-a')?.data['node-type']).toBe('service');
        expect(result.nodes.find((n) => n.id === 'svc-a')?.type).toBe('custom');
    });

    it('creates decision groups for oneOf nodes', () => {
        const pattern = makePattern([
            {
                oneOf: [
                    schemaNode('option-a', 'Option A', 'service'),
                    schemaNode('option-b', 'Option B', 'service'),
                ],
            },
        ]);
        const result = parsePatternData(pattern);

        // Should have 2 regular nodes + 1 decision group
        const regularNodes = result.nodes.filter((n) => n.type === 'custom');
        const groupNodes = result.nodes.filter((n) => n.type === 'decisionGroup');
        expect(regularNodes).toHaveLength(2);
        expect(groupNodes).toHaveLength(1);
        expect(groupNodes[0].data.decisionType).toBe('oneOf');

        // Regular nodes should be children of the group
        expect(regularNodes[0].parentId).toBe(groupNodes[0].id);
        expect(regularNodes[1].parentId).toBe(groupNodes[0].id);
    });

    it('creates decision groups for anyOf nodes', () => {
        const pattern = makePattern([
            {
                anyOf: [
                    schemaNode('opt-x', 'Option X', 'service'),
                    schemaNode('opt-y', 'Option Y', 'database'),
                ],
            },
        ]);
        const result = parsePatternData(pattern);

        const groupNodes = result.nodes.filter((n) => n.type === 'decisionGroup');
        expect(groupNodes).toHaveLength(1);
        expect(groupNodes[0].data.decisionType).toBe('anyOf');
    });

    it('creates edges from connects relationships', () => {
        const pattern = makePattern(
            [
                schemaNode('node-1', 'Node 1', 'service'),
                schemaNode('node-2', 'Node 2', 'service'),
            ],
            [connectsRelationship('rel-1', 'node-1', 'node-2')]
        );
        const result = parsePatternData(pattern);
        expect(result.edges).toHaveLength(1);
        expect(result.edges[0].source).toBe('node-1');
        expect(result.edges[0].target).toBe('node-2');
        expect(result.edges[0].data.description).toBe('node-1 to node-2');
    });

    it('creates edges from interacts relationships', () => {
        const pattern = makePattern(
            [
                schemaNode('actor-1', 'User', 'actor'),
                schemaNode('svc-1', 'Service', 'service'),
                schemaNode('svc-2', 'Service 2', 'service'),
            ],
            [
                {
                    properties: {
                        'unique-id': { const: 'rel-interact' },
                        description: { const: 'uses services' },
                        'relationship-type': {
                            const: {
                                interacts: {
                                    actor: 'actor-1',
                                    nodes: ['svc-1', 'svc-2'],
                                },
                            },
                        },
                    },
                },
            ]
        );
        const result = parsePatternData(pattern);
        // interacts with 2 targets creates 2 edges
        expect(result.edges).toHaveLength(2);
        expect(result.edges[0].source).toBe('actor-1');
        expect(result.edges[0].target).toBe('svc-1');
        expect(result.edges[1].source).toBe('actor-1');
        expect(result.edges[1].target).toBe('svc-2');
    });

    it('handles deployed-in relationships by setting parentId', () => {
        const pattern = makePattern(
            [
                schemaNode('k8s', 'Kubernetes', 'system'),
                schemaNode('svc-a', 'Service A', 'service'),
                schemaNode('svc-b', 'Service B', 'service'),
            ],
            [
                {
                    properties: {
                        'unique-id': { const: 'deploy-rel' },
                        description: { const: 'deployed in k8s' },
                        'relationship-type': {
                            const: {
                                'deployed-in': {
                                    container: 'k8s',
                                    nodes: ['svc-a', 'svc-b'],
                                },
                            },
                        },
                    },
                },
            ]
        );
        const result = parsePatternData(pattern);

        // Container becomes a group node
        const containerNode = result.nodes.find((n) => n.id === 'k8s');
        expect(containerNode?.type).toBe('group');

        // Children have parentId set
        const childA = result.nodes.find((n) => n.id === 'svc-a');
        const childB = result.nodes.find((n) => n.id === 'svc-b');
        expect(childA?.parentId).toBe('k8s');
        expect(childB?.parentId).toBe('k8s');

        // No edges for deployed-in
        expect(result.edges).toHaveLength(0);
    });

    it('handles composed-of relationships by setting parentId', () => {
        const pattern = makePattern(
            [
                schemaNode('system-1', 'System', 'system'),
                schemaNode('component-1', 'Component', 'service'),
            ],
            [
                {
                    properties: {
                        'unique-id': { const: 'composed-rel' },
                        description: { const: 'composed of' },
                        'relationship-type': {
                            const: {
                                'composed-of': {
                                    container: 'system-1',
                                    nodes: ['component-1'],
                                },
                            },
                        },
                    },
                },
            ]
        );
        const result = parsePatternData(pattern);

        const containerNode = result.nodes.find((n) => n.id === 'system-1');
        expect(containerNode?.type).toBe('group');

        const child = result.nodes.find((n) => n.id === 'component-1');
        expect(child?.parentId).toBe('system-1');

        expect(result.edges).toHaveLength(0);
    });

    it('extracts interfaces from nodes', () => {
        const pattern = makePattern([
            schemaNode('svc-1', 'Service', 'service', {
                interfaces: {
                    prefixItems: [
                        {
                            $ref: 'https://example.com/defs/url-interface',
                            properties: {
                                'unique-id': { const: 'svc-1-url' },
                            },
                        },
                        {
                            $ref: 'https://example.com/defs/port-interface',
                            properties: {
                                'unique-id': { const: 'svc-1-port' },
                            },
                        },
                    ],
                },
            }),
        ]);
        const result = parsePatternData(pattern);
        const node = result.nodes.find((n) => n.id === 'svc-1');
        expect(node?.data.interfaces).toHaveLength(2);
        expect(node?.data.interfaces[0]['unique-id']).toBe('svc-1-url');
        expect(node?.data.interfaces[0].type).toBe('url-interface');
        expect(node?.data.interfaces[1]['unique-id']).toBe('svc-1-port');
        expect(node?.data.interfaces[1].type).toBe('port-interface');
    });

    it('extracts controls from pattern schema', () => {
        const pattern = makePattern(
            [
                schemaNode('node-1', 'Node 1', 'service'),
                schemaNode('node-2', 'Node 2', 'service'),
            ],
            [
                {
                    properties: {
                        'unique-id': { const: 'rel-1' },
                        description: { const: 'secure connection' },
                        'relationship-type': {
                            const: {
                                connects: {
                                    source: { node: 'node-1' },
                                    destination: { node: 'node-2' },
                                },
                            },
                        },
                        controls: {
                            properties: {
                                security: {
                                    properties: {
                                        description: { const: 'Security Controls' },
                                        requirements: {
                                            prefixItems: [
                                                {
                                                    properties: {
                                                        'requirement-url': { const: 'https://example.com/req' },
                                                        'config-url': { const: 'https://example.com/config' },
                                                    },
                                                },
                                            ],
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            ]
        );
        const result = parsePatternData(pattern);
        expect(result.edges).toHaveLength(1);
        const edgeControls = result.edges[0].data.controls;
        expect(edgeControls).toBeDefined();
        expect(edgeControls.security).toBeDefined();
        expect(edgeControls.security.description).toBe('Security Controls');
        expect(edgeControls.security.requirements).toHaveLength(1);
        expect(edgeControls.security.requirements[0]['requirement-url']).toBe('https://example.com/req');
    });

    it('skips nodes without unique-id', () => {
        const pattern = makePattern([
            { properties: { name: { const: 'No ID Node' } } },
            schemaNode('valid-node', 'Valid', 'service'),
        ]);
        const result = parsePatternData(pattern);
        const regularNodes = result.nodes.filter((n) => n.type === 'custom');
        expect(regularNodes).toHaveLength(1);
        expect(regularNodes[0].id).toBe('valid-node');
    });

    it('handles options metadata on decision groups', () => {
        const pattern = makePattern(
            [
                {
                    oneOf: [
                        schemaNode('opt-a', 'Option A', 'service'),
                        schemaNode('opt-b', 'Option B', 'service'),
                    ],
                },
                schemaNode('target-1', 'Target', 'service'),
            ],
            [
                // Options relationship pointing at the oneOf group
                {
                    properties: {
                        'unique-id': { const: 'options-rel' },
                        description: { const: 'Choose a backend' },
                        'relationship-type': {
                            properties: {
                                options: {
                                    prefixItems: [
                                        {
                                            oneOf: [
                                                {
                                                    properties: {
                                                        description: { const: 'Use Option A' },
                                                        nodes: { const: ['opt-a'] },
                                                        relationships: { const: ['rel-a'] },
                                                    },
                                                },
                                                {
                                                    properties: {
                                                        description: { const: 'Use Option B' },
                                                        nodes: { const: ['opt-b'] },
                                                        relationships: { const: ['rel-b'] },
                                                    },
                                                },
                                            ],
                                        },
                                    ],
                                },
                            },
                        },
                    },
                },
            ]
        );
        const result = parsePatternData(pattern);

        // The decision group should have options metadata
        const groupNode = result.nodes.find((n) => n.type === 'decisionGroup');
        expect(groupNode).toBeDefined();
        expect(groupNode?.data.prompt).toBe('Choose a backend');
        expect(groupNode?.data.choices).toHaveLength(2);
        expect(groupNode?.data.choices[0].description).toBe('Use Option A');
        expect(groupNode?.data.choices[1].description).toBe('Use Option B');
    });

    it('sets protocol on edges', () => {
        const pattern = makePattern(
            [
                schemaNode('node-1', 'Node 1', 'service'),
                schemaNode('node-2', 'Node 2', 'service'),
            ],
            [
                connectsRelationship('rel-1', 'node-1', 'node-2', {
                    protocol: { const: 'HTTPS' },
                }),
            ]
        );
        const result = parsePatternData(pattern);
        expect(result.edges).toHaveLength(1);
        expect(result.edges[0].data.protocol).toBe('HTTPS');
    });

    it('handles pattern with allOf structure', () => {
        const pattern = {
            allOf: [
                {
                    properties: {
                        nodes: {
                            prefixItems: [
                                schemaNode('node-1', 'Node 1', 'service'),
                            ],
                        },
                    },
                },
                {
                    properties: {
                        relationships: {
                            prefixItems: [],
                        },
                    },
                },
            ],
        };
        const result = parsePatternData(pattern);
        expect(result.nodes).toHaveLength(1);
        expect(result.nodes[0].id).toBe('node-1');
    });

    it('does not create edges for unknown node references', () => {
        const pattern = makePattern(
            [schemaNode('node-1', 'Node 1', 'service')],
            [connectsRelationship('rel-1', 'node-1', 'nonexistent-node')]
        );
        const result = parsePatternData(pattern);
        expect(result.edges).toHaveLength(0);
    });
});
