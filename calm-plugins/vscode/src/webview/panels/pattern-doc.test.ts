import { describe, it, expect } from 'vitest';
import { exportAsPattern, generateId } from './pattern-doc';

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

    it('preserves metadata including building-block-style colors', () => {
        const doc = {
            nodes: [
                {
                    'unique-id': 'green-svc',
                    'node-type': 'service',
                    name: 'Green',
                    metadata: {
                        'building-block-type': 'infrastructure',
                        'building-block-style': { background: '#38761D', text: '#FFFFFF' },
                    },
                },
            ],
            relationships: [],
        };

        const { json } = exportAsPattern(doc, 'Colored');
        const pattern = JSON.parse(json);
        const meta = pattern.properties.nodes.prefixItems[0].properties.metadata;
        expect(meta.properties['building-block-style'].properties.background.const).toBe('#38761D');
        expect(meta.properties['building-block-style'].properties.text.const).toBe('#FFFFFF');
        expect(meta.properties['building-block-type'].const).toBe('infrastructure');
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
});
