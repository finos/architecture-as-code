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

// Helper to build a pattern with both prefixItems (mandatory) and an
// items.oneOf/anyOf open catalog for nodes and/or relationships.
function makePatternWithItems(
    prefixNodes: unknown[],
    itemsCatalogNodes: unknown[] = [],
    relationships: unknown[] = [],
    itemsCatalogRelationships: unknown[] = [],
    catalogType: 'oneOf' | 'anyOf' = 'oneOf'
) {
    return {
        properties: {
            nodes: {
                prefixItems: prefixNodes,
                ...(itemsCatalogNodes.length > 0 && { items: { [catalogType]: itemsCatalogNodes } }),
            },
            relationships: {
                prefixItems: relationships,
                ...(itemsCatalogRelationships.length > 0 && { items: { [catalogType]: itemsCatalogRelationships } }),
            },
        },
    };
}

// Helper to build an options (decision) relationship schema item
function optionsRelationship(
    uniqueId: string,
    description: string,
    choices: { description: string; nodes: string[]; relationships?: string[] }[],
    optionType: 'oneOf' | 'anyOf' = 'oneOf'
) {
    return {
        properties: {
            'unique-id': { const: uniqueId },
            description: { const: description },
            'relationship-type': {
                properties: {
                    options: {
                        prefixItems: [
                            {
                                [optionType]: choices.map((c) => ({
                                    properties: {
                                        description: { const: c.description },
                                        nodes: { const: c.nodes },
                                        relationships: { const: c.relationships || [] },
                                    },
                                })),
                            },
                        ],
                    },
                },
            },
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

    it('creates a decision group box for an items catalog with no options relationship', () => {
        // An items.oneOf catalog with no decision referencing it still renders as a
        // oneOf-labelled group box (no prompt), exercising the extract-but-never-folded path.
        const pattern = {
            properties: {
                nodes: {
                    items: {
                        oneOf: [
                            schemaNode('cache', 'Cache', 'service'),
                            schemaNode('queue', 'Queue', 'service'),
                        ],
                    },
                },
                relationships: { prefixItems: [] },
            },
        };
        const result = parsePatternData(pattern);

        const groupNodes = result.nodes.filter((n) => n.type === 'decisionGroup');
        expect(groupNodes).toHaveLength(1);
        expect(groupNodes[0].data.decisionType).toBe('oneOf');
        expect(groupNodes[0].data.prompt).toBeUndefined();

        const regularNodes = result.nodes.filter((n) => n.type === 'custom');
        expect(regularNodes).toHaveLength(2);
        expect(regularNodes.every((n) => n.parentId === groupNodes[0].id)).toBe(true);
    });

    it('creates an anyOf decision group for an items.anyOf node catalog', () => {
        // The UI-side anyOf catalog path: nodes declared through items.anyOf must
        // produce an anyOf-typed decision group whose candidates parent into it,
        // mirroring the oneOf case above.
        const pattern = makePatternWithItems(
            [],
            [
                schemaNode('redis', 'Redis', 'service'),
                schemaNode('kafka', 'Kafka', 'service'),
            ],
            [],
            [],
            'anyOf'
        );
        const result = parsePatternData(pattern);

        const groupNodes = result.nodes.filter((n) => n.type === 'decisionGroup');
        expect(groupNodes).toHaveLength(1);
        expect(groupNodes[0].data.decisionType).toBe('anyOf');

        const regularNodes = result.nodes.filter((n) => n.type === 'custom');
        expect(regularNodes).toHaveLength(2);
        expect(regularNodes.every((n) => n.parentId === groupNodes[0].id)).toBe(true);
    });

    it('renders edges from a relationships items catalog as dashed decision edges', () => {
        // Relationships declared solely through an items.oneOf catalog flow through
        // the `rel-decision-items` branch and carry a decisionGroupId, so their
        // edges must render dashed (strokeDasharray '5,5') — unlike the solid edge a
        // plain prefixItems connects relationship produces.
        const pattern = makePatternWithItems(
            [
                schemaNode('node-1', 'Node 1', 'service'),
                schemaNode('node-2', 'Node 2', 'service'),
            ],
            [],
            [],
            [connectsRelationship('rel-cat', 'node-1', 'node-2')]
        );
        const result = parsePatternData(pattern);

        expect(result.edges).toHaveLength(1);
        expect(result.edges[0].source).toBe('node-1');
        expect(result.edges[0].target).toBe('node-2');
        expect(result.edges[0].style?.strokeDasharray).toBe('5,5');
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

    it('renders a decision candidate that is also a container child inside the container, not the choice box', () => {
        // opt-a is both a oneOf decision candidate AND deployed inside the k8s
        // container. The container must win: opt-a's parent is k8s. opt-b, which is
        // not in any container, stays in the decision group.
        const pattern = makePattern(
            [
                schemaNode('k8s', 'Kubernetes', 'system'),
                {
                    oneOf: [
                        schemaNode('opt-a', 'Option A', 'service'),
                        schemaNode('opt-b', 'Option B', 'service'),
                    ],
                },
            ],
            [
                {
                    properties: {
                        'unique-id': { const: 'deploy-a' },
                        'relationship-type': {
                            const: { 'deployed-in': { container: 'k8s', nodes: ['opt-a'] } },
                        },
                    },
                },
            ]
        );
        const result = parsePatternData(pattern);

        expect(result.nodes.find((n) => n.id === 'opt-a')?.parentId).toBe('k8s');
        const groupNodes = result.nodes.filter((n) => n.type === 'decisionGroup');
        expect(groupNodes).toHaveLength(1);
        expect(result.nodes.find((n) => n.id === 'opt-b')?.parentId).toBe(groupNodes[0].id);
    });

    it('does not render an empty decision box when every candidate is pulled into a container', () => {
        // Both oneOf candidates are deployed inside k8s, so the decision group is
        // emptied by container precedence and must not be drawn as an empty box.
        const pattern = makePattern(
            [
                schemaNode('k8s', 'Kubernetes', 'system'),
                {
                    oneOf: [
                        schemaNode('opt-a', 'Option A', 'service'),
                        schemaNode('opt-b', 'Option B', 'service'),
                    ],
                },
            ],
            [
                {
                    properties: {
                        'unique-id': { const: 'deploy-both' },
                        'relationship-type': {
                            const: { 'deployed-in': { container: 'k8s', nodes: ['opt-a', 'opt-b'] } },
                        },
                    },
                },
            ]
        );
        const result = parsePatternData(pattern);

        expect(result.nodes.filter((n) => n.type === 'decisionGroup')).toHaveLength(0);
        expect(result.nodes.find((n) => n.id === 'opt-a')?.parentId).toBe('k8s');
        expect(result.nodes.find((n) => n.id === 'opt-b')?.parentId).toBe('k8s');
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

    it('extracts detailed-architecture from node details schema', () => {
        const pattern = makePattern([
            schemaNode('api-gateway', 'API Gateway', 'system', {
                details: {
                    properties: {
                        'detailed-architecture': {
                            const: '/calm/namespaces/finos/architectures/api-platform/versions/1-0-0',
                        },
                    },
                    required: ['detailed-architecture'],
                },
            }),
        ]);
        const result = parsePatternData(pattern);
        const node = result.nodes.find((n) => n.id === 'api-gateway');
        expect(node?.data.details).toEqual({
            'detailed-architecture': '/calm/namespaces/finos/architectures/api-platform/versions/1-0-0',
        });
    });

    it('does not create edges for unknown node references', () => {
        const pattern = makePattern(
            [schemaNode('node-1', 'Node 1', 'service')],
            [connectsRelationship('rel-1', 'node-1', 'nonexistent-node')]
        );
        const result = parsePatternData(pattern);
        expect(result.edges).toHaveLength(0);
    });

    it('creates a decision group for a decision referencing only items-declared catalog candidates', () => {
        const pattern = makePatternWithItems(
            [schemaNode('webapp', 'Web App', 'service')],
            [schemaNode('cache', 'Cache', 'service'), schemaNode('queue', 'Queue', 'service')],
            [
                optionsRelationship('options-rel', 'Choose extras', [
                    { description: 'Use Cache', nodes: ['cache'] },
                    { description: 'Use Queue', nodes: ['queue'] },
                ]),
            ]
        );
        const result = parsePatternData(pattern);

        const groupNodes = result.nodes.filter((n) => n.type === 'decisionGroup');
        expect(groupNodes).toHaveLength(1);
        expect(groupNodes[0].data.prompt).toBe('Choose extras');
        expect(groupNodes[0].data.choices).toHaveLength(2);

        const cacheNode = result.nodes.find((n) => n.id === 'cache');
        const queueNode = result.nodes.find((n) => n.id === 'queue');
        expect(cacheNode?.parentId).toBe(groupNodes[0].id);
        expect(queueNode?.parentId).toBe(groupNodes[0].id);
    });

    it('folds a decision referencing a mix of prefixItems- and items-declared candidates into one group', () => {
        const pattern = makePatternWithItems(
            [
                {
                    oneOf: [
                        schemaNode('option-a', 'Option A', 'service'),
                        schemaNode('option-b', 'Option B', 'service'),
                    ],
                },
            ],
            [schemaNode('cache', 'Cache', 'service')],
            [
                optionsRelationship('options-rel', 'Choose a setup', [
                    { description: 'Use A with cache', nodes: ['option-a', 'cache'] },
                    { description: 'Use B', nodes: ['option-b'] },
                ]),
            ]
        );
        const result = parsePatternData(pattern);

        const groupNodes = result.nodes.filter((n) => n.type === 'decisionGroup');
        expect(groupNodes).toHaveLength(1);

        const optionA = result.nodes.find((n) => n.id === 'option-a');
        const optionB = result.nodes.find((n) => n.id === 'option-b');
        const cache = result.nodes.find((n) => n.id === 'cache');
        expect(optionA?.parentId).toBe(groupNodes[0].id);
        expect(optionB?.parentId).toBe(groupNodes[0].id);
        expect(cache?.parentId).toBe(groupNodes[0].id);
    });

    it('renders nothing for a decision referencing only a dangling/typo\'d id', () => {
        const pattern = makePattern(
            [schemaNode('webapp', 'Web App', 'service')],
            [
                optionsRelationship('options-rel', 'Choose extras', [
                    { description: 'Use nonexistent', nodes: ['nonexistent-node'] },
                ]),
            ]
        );
        const result = parsePatternData(pattern);

        const groupNodes = result.nodes.filter((n) => n.type === 'decisionGroup');
        expect(groupNodes).toHaveLength(0);
        expect(result.nodes.find((n) => n.id === 'nonexistent-node')).toBeUndefined();
    });
});

describe('nested container ordering', () => {
    function deployedInRel(uniqueId: string, container: string, child: string) {
        return {
            properties: {
                'unique-id': { const: uniqueId },
                'relationship-type': {
                    const: { 'deployed-in': { container, nodes: [child] } },
                },
            },
        };
    }

    // A > B > C > system, nested containers listed out of order (A, C, B, system).
    const pattern = {
        properties: {
            nodes: {
                prefixItems: [
                    schemaNode('A', 'A', 'system'),
                    schemaNode('C', 'C', 'system'),
                    schemaNode('B', 'B', 'system'),
                    schemaNode('system', 'system', 'service'),
                ],
            },
            relationships: {
                prefixItems: [
                    deployedInRel('b-in-a', 'A', 'B'),
                    deployedInRel('c-in-b', 'B', 'C'),
                    deployedInRel('s-in-c', 'C', 'system'),
                ],
            },
        },
    };

    it('emits every parent before its children', () => {
        const order = parsePatternData(pattern).nodes.map((n) => n.id);
        const parentOf: Record<string, string> = { B: 'A', C: 'B', system: 'C' };
        for (const [child, parent] of Object.entries(parentOf)) {
            expect(order.indexOf(parent)).toBeLessThan(order.indexOf(child));
        }
    });

    it('keeps all four nodes', () => {
        const ids = parsePatternData(pattern).nodes.map((n) => n.id).sort();
        expect(ids).toEqual(['A', 'B', 'C', 'system']);
    });
});

describe('decision groups are keyed per decision, not per declaration site', () => {
    const cacheQueueCatalog = [
        schemaNode('redis', 'Redis', 'database'),
        schemaNode('memcached', 'Memcached', 'database'),
        schemaNode('kafka', 'Kafka', 'queue'),
        schemaNode('rabbitmq', 'RabbitMQ', 'queue'),
    ];

    type RfNode = { id: string; type?: string; parentId?: string; data: Record<string, never> };

    /** The prompt on each rendered decision box, sorted. */
    const prompts = (nodes: RfNode[]) =>
        nodes.filter((n) => n.type === 'decisionGroup').map((n) => n.data.prompt as unknown as string).sort();

    /** The box a candidate was placed in. Fails the test if it is in none. */
    const boxOf = (nodes: RfNode[], id: string): string => {
        const parentId = nodes.find((n) => n.id === id)?.parentId;
        expect(parentId, `${id} is in no decision box`).toBeDefined();
        return parentId as string;
    };

    /** The choice descriptions on the box carrying a given prompt. */
    const choicesFor = (nodes: RfNode[], prompt: string): string[] => {
        const box = nodes.find((n) => n.type === 'decisionGroup' && n.data.prompt === prompt);
        expect(box, `no decision box with prompt "${prompt}"`).toBeDefined();
        return (box!.data.choices as unknown as { description: string }[]).map((c) => c.description);
    };

    const twoDecisionPattern = (relationships: unknown[]) =>
        makePatternWithItems(
            [schemaNode('webapp', 'Web App', 'service')],
            cacheQueueCatalog,
            relationships,
            [],
            'anyOf'
        );

    const cacheDecision = optionsRelationship('cache-choice', 'Pick a cache', [
        { description: 'Use Redis', nodes: ['redis'] },
        { description: 'Use Memcached', nodes: ['memcached'] },
    ]);
    const queueDecision = optionsRelationship('queue-choice', 'Pick a queue', [
        { description: 'Use Kafka', nodes: ['kafka'] },
        { description: 'Use RabbitMQ', nodes: ['rabbitmq'] },
    ]);

    it('renders one box per decision when two decisions draw from one catalog', () => {
        const result = parsePatternData(twoDecisionPattern([cacheDecision, queueDecision])) as { nodes: RfNode[] };

        expect(prompts(result.nodes)).toEqual(['Pick a cache', 'Pick a queue']);

        // Each box carries its own choices, not the other decision's.
        expect(choicesFor(result.nodes, 'Pick a cache')).toEqual(['Use Redis', 'Use Memcached']);
        expect(choicesFor(result.nodes, 'Pick a queue')).toEqual(['Use Kafka', 'Use RabbitMQ']);

        // Every candidate is drawn, and each decision's candidates share one box.
        ['redis', 'memcached', 'kafka', 'rabbitmq'].forEach((id) =>
            expect(result.nodes.find((n) => n.id === id), id).toBeDefined()
        );
        expect(boxOf(result.nodes, 'redis')).toBe(boxOf(result.nodes, 'memcached'));
        expect(boxOf(result.nodes, 'kafka')).toBe(boxOf(result.nodes, 'rabbitmq'));
        expect(boxOf(result.nodes, 'redis')).not.toBe(boxOf(result.nodes, 'kafka'));
    });

    it('still renders one box when one decision draws from one catalog', () => {
        const pattern = makePatternWithItems(
            [schemaNode('webapp', 'Web App', 'service')],
            [schemaNode('redis', 'Redis', 'database'), schemaNode('memcached', 'Memcached', 'database')],
            [cacheDecision],
            [],
            'anyOf'
        );
        const result = parsePatternData(pattern) as { nodes: RfNode[] };

        expect(prompts(result.nodes)).toEqual(['Pick a cache']);
        expect(choicesFor(result.nodes, 'Pick a cache')).toEqual(['Use Redis', 'Use Memcached']);
        expect(boxOf(result.nodes, 'redis')).toBe(boxOf(result.nodes, 'memcached'));
    });

    it('gives a shared candidate to the first decision and still renders the second', () => {
        // memcached is named by both. A node has one parent, so the first decision
        // keeps it and the second renders with what is left.
        const storeDecision = optionsRelationship('store-choice', 'Pick a store', [
            { description: 'Use Memcached', nodes: ['memcached'] },
            { description: 'Use Kafka', nodes: ['kafka'] },
        ]);
        // Exactly the three candidates the two decisions name. A fourth, unreferenced
        // candidate would keep its own declaration-site box and is not what this pins.
        const pattern = makePatternWithItems(
            [schemaNode('webapp', 'Web App', 'service')],
            [
                schemaNode('redis', 'Redis', 'database'),
                schemaNode('memcached', 'Memcached', 'database'),
                schemaNode('kafka', 'Kafka', 'queue'),
            ],
            [cacheDecision, storeDecision],
            [],
            'anyOf'
        );
        const result = parsePatternData(pattern) as { nodes: RfNode[] };

        expect(prompts(result.nodes)).toEqual(['Pick a cache', 'Pick a store']);
        expect(boxOf(result.nodes, 'memcached')).toBe(boxOf(result.nodes, 'redis'));
        expect(boxOf(result.nodes, 'kafka')).not.toBe(boxOf(result.nodes, 'redis'));

        // The second box still offers the shared candidate as a choice. Only the
        // drawing is exclusive, not the decision.
        expect(choicesFor(result.nodes, 'Pick a store')).toEqual(['Use Memcached', 'Use Kafka']);
    });

    it('is declaration order that decides which decision keeps a shared candidate', () => {
        const storeDecision = optionsRelationship('store-choice', 'Pick a store', [
            { description: 'Use Memcached', nodes: ['memcached'] },
            { description: 'Use Kafka', nodes: ['kafka'] },
        ]);
        const pattern = makePatternWithItems(
            [schemaNode('webapp', 'Web App', 'service')],
            [
                schemaNode('redis', 'Redis', 'database'),
                schemaNode('memcached', 'Memcached', 'database'),
                schemaNode('kafka', 'Kafka', 'queue'),
            ],
            [storeDecision, cacheDecision],
            [],
            'anyOf'
        );
        const reversed = parsePatternData(pattern) as { nodes: RfNode[] };

        // Same two decisions, declared the other way round: now the store box keeps it.
        expect(boxOf(reversed.nodes, 'memcached')).toBe(boxOf(reversed.nodes, 'kafka'));
        expect(boxOf(reversed.nodes, 'memcached')).not.toBe(boxOf(reversed.nodes, 'redis'));
    });

    it('renders no box for a decision whose candidates are all claimed by an earlier one', () => {
        // A documented limit, not a fix. Boxing one node twice needs #2933.
        const pattern = makePatternWithItems(
            [schemaNode('webapp', 'Web App', 'service')],
            [schemaNode('redis', 'Redis', 'database')],
            [
                optionsRelationship('cache-choice', 'Pick a cache', [
                    { description: 'Use Redis', nodes: ['redis'] },
                ]),
                optionsRelationship('store-choice', 'Pick a store', [
                    { description: 'Use Redis', nodes: ['redis'] },
                ]),
            ],
            [],
            'anyOf'
        );
        const result = parsePatternData(pattern) as { nodes: RfNode[] };

        expect(prompts(result.nodes)).toEqual(['Pick a cache']);
    });
});

describe('decisions and containers', () => {
    type RfNode = { id: string; type?: string; parentId?: string; data: Record<string, never> };

    const deployedIn = (uniqueId: string, container: string, nodes: string[]) => ({
        properties: {
            'unique-id': { const: uniqueId },
            'relationship-type': { const: { 'deployed-in': { container, nodes } } },
        },
    });

    it('keeps the decision box when every candidate is itself a container', () => {
        // opt-a and opt-b each contain a leaf, so both are containers. The box must
        // still carry the decision text. Nesting them inside it is #2933.
        const pattern = makePattern(
            [
                schemaNode('opt-a', 'Option A', 'system'),
                schemaNode('opt-b', 'Option B', 'system'),
                schemaNode('leaf-a', 'Leaf A', 'service'),
                schemaNode('leaf-b', 'Leaf B', 'service'),
            ],
            [
                deployedIn('deploy-a', 'opt-a', ['leaf-a']),
                deployedIn('deploy-b', 'opt-b', ['leaf-b']),
                optionsRelationship('subsystem-choice', 'Pick a subsystem', [
                    { description: 'Use A', nodes: ['opt-a'] },
                    { description: 'Use B', nodes: ['opt-b'] },
                ]),
            ]
        );
        const result = parsePatternData(pattern) as { nodes: RfNode[] };

        const groups = result.nodes.filter((n) => n.type === 'decisionGroup');
        expect(groups).toHaveLength(1);
        expect(groups[0].data.prompt).toBe('Pick a subsystem');

        // The containers must NOT be nested inside the box - that is #2933's change.
        expect(result.nodes.find((n) => n.id === 'opt-a')?.parentId).toBeUndefined();
        expect(result.nodes.find((n) => n.id === 'opt-b')?.parentId).toBeUndefined();

        // Containment is unchanged.
        expect(result.nodes.find((n) => n.id === 'leaf-a')?.parentId).toBe('opt-a');
        expect(result.nodes.find((n) => n.id === 'leaf-b')?.parentId).toBe('opt-b');
    });

    it('still suppresses the box when every candidate is pulled into a container', () => {
        // The other branch: the candidates are container children, not containers.
        // Suppression stays, even though a prompt exists to lose.
        const pattern = makePattern(
            [
                schemaNode('k8s', 'Kubernetes', 'system'),
                schemaNode('opt-a', 'Option A', 'service'),
                schemaNode('opt-b', 'Option B', 'service'),
            ],
            [
                deployedIn('deploy-both', 'k8s', ['opt-a', 'opt-b']),
                optionsRelationship('svc-choice', 'Pick a service', [
                    { description: 'Use A', nodes: ['opt-a'] },
                    { description: 'Use B', nodes: ['opt-b'] },
                ]),
            ]
        );
        const result = parsePatternData(pattern) as { nodes: RfNode[] };

        expect(result.nodes.filter((n) => n.type === 'decisionGroup')).toHaveLength(0);
        expect(result.nodes.find((n) => n.id === 'opt-a')?.parentId).toBe('k8s');
        expect(result.nodes.find((n) => n.id === 'opt-b')?.parentId).toBe('k8s');
    });
});
