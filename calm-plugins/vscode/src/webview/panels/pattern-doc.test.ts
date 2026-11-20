import { describe, it, expect } from 'vitest';
import { exportAsPattern, generateId } from './pattern-doc';
import { instantiateFromPattern } from './pattern-instantiation';
import { CALM_META_SCHEMA_BASE_URL } from '../../core/calm-schema-release';

describe('generateId', () => {
    it('lowercases and kebab-cases', () => {
        expect(generateId('My Pattern')).toBe('my-pattern');
    });
});

describe('exportAsPattern', () => {
    it('converts a CALM document into a pattern JSON Schema', () => {
        const doc = {
            nodes: [
                {
                    'unique-id': 'web-app',
                    'node-type': 'webclient',
                    name: 'Web App',
                    description: 'Frontend',
                },
                {
                    'unique-id': 'api-svc',
                    'node-type': 'service',
                    name: 'API Service',
                },
            ],
            relationships: [
                {
                    'unique-id': 'web-to-api',
                    'relationship-type': { connects: { source: { node: 'web-app' }, destination: { node: 'api-svc' } } },
                },
            ],
        };

        const { json, fileName } = exportAsPattern(doc, 'My App Pattern');
        const pattern = JSON.parse(json);

        expect(fileName).toBe('my-app-pattern.pattern.json');
        expect(pattern.title).toBe('My App Pattern');
        expect(pattern.type).toBe('object');
        expect(pattern.required).toEqual(['nodes', 'relationships']);

        const nodeItems = pattern.properties.nodes.prefixItems;
        expect(nodeItems).toHaveLength(2);
        expect(nodeItems[0].properties['unique-id'].const).toBe('web-app');
        expect(nodeItems[0].properties.name.const).toBe('Web App');
        expect(nodeItems[0].properties['node-type'].const).toBe('webclient');
        expect(nodeItems[0].properties.description.const).toBe('Frontend');

        const relItems = pattern.properties.relationships.prefixItems;
        expect(relItems).toHaveLength(1);
        expect(relItems[0].properties['unique-id'].const).toBe('web-to-api');
        const relType = relItems[0].properties['relationship-type'];
        expect(relType.properties.connects.properties.source.properties.node.const).toBe('web-app');
    });

    it('preserves metadata including standard-node-style colors', () => {
        const doc = {
            nodes: [
                {
                    'unique-id': 'green-svc',
                    'node-type': 'service',
                    name: 'Green',
                    metadata: {
                        'standard-node-type': 'infrastructure',
                        'standard-node-style': { background: '#38761D', text: '#FFFFFF' },
                    },
                },
            ],
            relationships: [],
        };

        const { json } = exportAsPattern(doc, 'Colored');
        const pattern = JSON.parse(json);
        const meta = pattern.properties.nodes.prefixItems[0].properties.metadata;
        expect(meta.properties['standard-node-style'].properties.background.const).toBe('#38761D');
        expect(meta.properties['standard-node-style'].properties.text.const).toBe('#FFFFFF');
        expect(meta.properties['standard-node-type'].const).toBe('infrastructure');
    });

    it('preserves controls on nodes', () => {
        const doc = {
            nodes: [
                {
                    'unique-id': 'svc',
                    'node-type': 'service',
                    name: 'Svc',
                    controls: {
                        'platform--resiliency-tier': {
                            requirements: [{ 'requirement-url': 'platform:controls:resiliency-tier' }],
                        },
                    },
                },
            ],
            relationships: [],
        };

        const { json } = exportAsPattern(doc, 'WithControls');
        const pattern = JSON.parse(json);
        const ctrlProps = pattern.properties.nodes.prefixItems[0].properties.controls;
        const req = ctrlProps.properties['platform--resiliency-tier']
            .properties.requirements.prefixItems[0]
            .properties['requirement-url'];
        expect(req.const).toBe('platform:controls:resiliency-tier');
    });

    it('handles an empty document', () => {
        const { json } = exportAsPattern({}, 'Empty');
        const pattern = JSON.parse(json);
        expect(pattern.properties.nodes.prefixItems).toEqual([]);
        expect(pattern.properties.relationships.prefixItems).toEqual([]);
    });

    it('preserves flows in exported pattern', () => {
        const doc = {
            nodes: [{ 'unique-id': 'svc', 'node-type': 'service', name: 'Svc', description: 'A service' }],
            relationships: [
                { 'unique-id': 'rel-1', 'relationship-type': { connects: { source: { node: 'a' }, destination: { node: 'svc' } } } },
            ],
            flows: [
                {
                    'unique-id': 'flow-1',
                    name: 'Publish',
                    description: 'Publish flow',
                    transitions: [
                        { 'relationship-unique-id': 'rel-1', 'sequence-number': 1, description: 'Step 1' },
                        { 'relationship-unique-id': 'rel-1', 'sequence-number': 2, description: 'Step 2', direction: 'destination-to-source' },
                    ],
                },
            ],
        };

        const { json } = exportAsPattern(doc, 'WithFlows');
        const pattern = JSON.parse(json);

        expect(pattern.required).toEqual(['nodes', 'relationships', 'flows']);
        const flowItems = pattern.properties.flows.prefixItems;
        expect(flowItems).toHaveLength(1);
        expect(flowItems[0].$ref).toBe(`${CALM_META_SCHEMA_BASE_URL}/flow.json#/defs/flow`);
        expect(flowItems[0].properties['unique-id'].const).toBe('flow-1');
        expect(flowItems[0].properties.name.const).toBe('Publish');

        const transitions = flowItems[0].properties.transitions.prefixItems;
        expect(transitions).toHaveLength(2);
        expect(transitions[0].properties['relationship-unique-id'].const).toBe('rel-1');
        expect(transitions[0].properties['sequence-number'].const).toBe(1);
        expect(transitions[1].properties.direction.const).toBe('destination-to-source');
    });

    it('flows required only when present', () => {
        const docNoFlows = { nodes: [], relationships: [], flows: [] };
        const { json } = exportAsPattern(docNoFlows, 'NoFlows');
        const pattern = JSON.parse(json);
        expect(pattern.required).toEqual(['nodes', 'relationships']);
        expect(pattern.properties.flows).toBeUndefined();
    });

    it('preserves flow controls', () => {
        const doc = {
            nodes: [],
            relationships: [],
            flows: [
                {
                    'unique-id': 'ctrl-flow',
                    name: 'Controlled',
                    description: 'A flow with controls',
                    transitions: [{ 'relationship-unique-id': 'r1', 'sequence-number': 1, description: 'Go' }],
                    controls: {
                        'security--encryption': {
                            requirements: [{ 'requirement-url': 'security:controls:encryption' }],
                        },
                    },
                },
            ],
        };

        const { json } = exportAsPattern(doc, 'FlowControls');
        const pattern = JSON.parse(json);
        const ctrl = pattern.properties.flows.prefixItems[0].properties.controls;
        const req = ctrl.properties['security--encryption']
            .properties.requirements.prefixItems[0]
            .properties['requirement-url'];
        expect(req.const).toBe('security:controls:encryption');
    });

    it('preserves flow requirement-url', () => {
        const doc = {
            nodes: [],
            relationships: [],
            flows: [
                {
                    'unique-id': 'req-flow',
                    name: 'With Req',
                    description: 'A flow with requirement-url',
                    'requirement-url': 'https://requirements.example.com/login',
                    transitions: [{ 'relationship-unique-id': 'r1', 'sequence-number': 1, description: 'Go' }],
                },
            ],
        };

        const { json } = exportAsPattern(doc, 'FlowReqUrl');
        const pattern = JSON.parse(json);
        const reqUrl = pattern.properties.flows.prefixItems[0].properties['requirement-url'];
        expect(reqUrl.const).toBe('https://requirements.example.com/login');
    });

    it('exports multiple flows', () => {
        const doc = {
            nodes: [],
            relationships: [],
            flows: [
                {
                    'unique-id': 'flow-a',
                    name: 'Flow A',
                    description: 'First',
                    transitions: [{ 'relationship-unique-id': 'r1', 'sequence-number': 1, description: 'Step' }],
                },
                {
                    'unique-id': 'flow-b',
                    name: 'Flow B',
                    description: 'Second',
                    transitions: [{ 'relationship-unique-id': 'r2', 'sequence-number': 1, description: 'Step' }],
                },
            ],
        };

        const { json } = exportAsPattern(doc, 'MultiFlows');
        const pattern = JSON.parse(json);
        const flowItems = pattern.properties.flows.prefixItems;
        expect(flowItems).toHaveLength(2);
        expect(flowItems[0].properties['unique-id'].const).toBe('flow-a');
        expect(flowItems[1].properties['unique-id'].const).toBe('flow-b');
        expect(pattern.properties.flows.minItems).toBe(2);
    });

    it('preserves flow metadata (flow-style)', () => {
        const doc = {
            nodes: [],
            relationships: [],
            flows: [
                {
                    'unique-id': 'styled-flow',
                    name: 'Styled',
                    description: 'A styled flow',
                    transitions: [{ 'relationship-unique-id': 'r1', 'sequence-number': 1, description: 'Go' }],
                    metadata: { 'flow-style': { background: '#3b82f6', text: '#ffffff' } },
                },
            ],
        };

        const { json } = exportAsPattern(doc, 'StyledFlows');
        const pattern = JSON.parse(json);
        const meta = pattern.properties.flows.prefixItems[0].properties.metadata;
        expect(meta.properties['flow-style'].properties.background.const).toBe('#3b82f6');
        expect(meta.properties['flow-style'].properties.text.const).toBe('#ffffff');
    });
});

describe('instantiateFromPattern', () => {
    it('instantiates flows from pattern', () => {
        const schema = {
            properties: {
                nodes: { prefixItems: [] },
                relationships: { prefixItems: [] },
                flows: {
                    prefixItems: [
                        {
                            properties: {
                                'unique-id': { const: 'flow-1' },
                                name: { const: 'My Flow' },
                                description: { const: 'Test flow' },
                                transitions: {
                                    prefixItems: [
                                        {
                                            properties: {
                                                'relationship-unique-id': { const: 'rel-1' },
                                                'sequence-number': { const: 1 },
                                                description: { const: 'Step one' },
                                            },
                                        },
                                    ],
                                },
                            },
                        },
                    ],
                },
            },
        };

        const result = instantiateFromPattern(schema);
        expect(result.flows).toHaveLength(1);
        expect(result.flows[0]['unique-id']).toBe('flow-1');
        expect(result.flows[0].name).toBe('My Flow');
        expect(result.flows[0].transitions).toHaveLength(1);
        expect(result.flows[0].transitions[0]['relationship-unique-id']).toBe('rel-1');
    });

    it('omits flows when the pattern has none', () => {
        const schema = {
            properties: {
                nodes: { prefixItems: [] },
                relationships: { prefixItems: [] },
            },
        };

        const result = instantiateFromPattern(schema);
        expect(result.flows).toBeUndefined();
    });

    it('provides defaults for missing flow fields', () => {
        const schema = {
            properties: {
                nodes: { prefixItems: [] },
                relationships: { prefixItems: [] },
                flows: {
                    prefixItems: [{ properties: {} }],
                },
            },
        };

        const result = instantiateFromPattern(schema);
        expect(result.flows[0]['unique-id']).toBe('[[PLACEHOLDER]]');
        expect(result.flows[0].name).toBe('[[PLACEHOLDER]]');
        expect(result.flows[0].description).toBe('');
        expect(result.flows[0].transitions).toEqual([]);
    });
});

describe('export-instantiate round-trip', () => {
    it('preserves flows through export then instantiate', () => {
        const doc = {
            nodes: [
                { 'unique-id': 'ui', 'node-type': 'webclient', name: 'UI', description: 'Frontend' },
                { 'unique-id': 'api', 'node-type': 'service', name: 'API', description: 'Backend' },
            ],
            relationships: [
                { 'unique-id': 'ui-to-api', 'relationship-type': { connects: { source: { node: 'ui' }, destination: { node: 'api' } } } },
            ],
            flows: [
                {
                    'unique-id': 'login-flow',
                    name: 'User Login',
                    description: 'Login sequence',
                    transitions: [
                        { 'relationship-unique-id': 'ui-to-api', 'sequence-number': 1, description: 'Submit credentials' },
                        { 'relationship-unique-id': 'ui-to-api', 'sequence-number': 2, description: 'Return token', direction: 'destination-to-source' },
                    ],
                },
            ],
        };

        const { json } = exportAsPattern(doc, 'RoundTrip');
        const pattern = JSON.parse(json);
        const result = instantiateFromPattern(pattern);

        expect(result.flows).toHaveLength(1);
        expect(result.flows[0]['unique-id']).toBe('login-flow');
        expect(result.flows[0].name).toBe('User Login');
        expect(result.flows[0].transitions).toHaveLength(2);
        expect(result.flows[0].transitions[0]['relationship-unique-id']).toBe('ui-to-api');
        expect(result.flows[0].transitions[1].direction).toBe('destination-to-source');

        expect(result.nodes).toHaveLength(2);
        expect(result.relationships).toHaveLength(1);
        expect(result.relationships[0]['unique-id']).toBe('ui-to-api');
    });

    it('preserves flow metadata and controls through round-trip', () => {
        const doc = {
            nodes: [{ 'unique-id': 'n1', 'node-type': 'service', name: 'N1', description: 'Node' }],
            relationships: [
                { 'unique-id': 'r1', 'relationship-type': { connects: { source: { node: 'n1' }, destination: { node: 'n1' } } } },
            ],
            flows: [
                {
                    'unique-id': 'styled-ctrl-flow',
                    name: 'Styled Controlled',
                    description: 'Flow with metadata and controls',
                    'requirement-url': 'https://req.example.com/flow',
                    transitions: [{ 'relationship-unique-id': 'r1', 'sequence-number': 1, description: 'Go' }],
                    metadata: { 'flow-style': { background: '#ef4444', text: '#000' } },
                    controls: {
                        'audit-logging': {
                            requirements: [{ 'requirement-url': 'compliance:audit' }],
                        },
                    },
                },
            ],
        };

        const { json } = exportAsPattern(doc, 'MetaRoundTrip');
        const pattern = JSON.parse(json);
        const result = instantiateFromPattern(pattern);

        const flow = result.flows[0];
        expect(flow['unique-id']).toBe('styled-ctrl-flow');
        expect(flow['requirement-url']).toBe('https://req.example.com/flow');
        expect(flow.metadata['flow-style'].background).toBe('#ef4444');
        expect(flow.controls['audit-logging'].requirements[0]['requirement-url']).toBe('compliance:audit');
    });
});
