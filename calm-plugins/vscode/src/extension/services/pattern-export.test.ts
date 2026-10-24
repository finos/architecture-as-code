import { describe, it, expect } from 'vitest';
import { buildArchitecturePattern } from './pattern-export';
import { CALM_META_SCHEMA_BASE_URL } from '../../core/calm-schema-release';

const NODE_REF = `${CALM_META_SCHEMA_BASE_URL}/core.json#/defs/node`;
const RELATIONSHIP_REF = `${CALM_META_SCHEMA_BASE_URL}/core.json#/defs/relationship`;

describe('buildArchitecturePattern', () => {
    it('builds a pattern for a small canvas', () => {
        const doc = {
            $schema: 'https://calm.finos.org/release/1.2/meta/calm.json',
            nodes: [
                {
                    'unique-id': 'web-app',
                    'node-type': 'webclient',
                    name: 'Web App',
                    description: 'Frontend',
                    interfaces: [{ 'unique-id': 'web-port', port: 443 }],
                    metadata: { owner: 'team-a', retired: null },
                    notes: undefined,
                },
                { 'unique-id': 'api-svc', 'node-type': 'service', name: 'API Service' },
            ],
            relationships: [
                {
                    'unique-id': 'web-to-api',
                    'relationship-type': {
                        connects: { source: { node: 'web-app' }, destination: { node: 'api-svc' } },
                    },
                },
            ],
        };

        const { fileName, json } = buildArchitecturePattern(doc, '  My App Pattern! ');

        expect(fileName).toBe('my-app-pattern.pattern.json');
        expect(JSON.parse(json)).toEqual({
            $schema: `${CALM_META_SCHEMA_BASE_URL}/calm.json`,
            $id: 'patterns/my-app-pattern.pattern.json',
            type: 'object',
            title: 'My App Pattern!',
            description: 'Pattern derived from architecture: My App Pattern!',
            properties: {
                nodes: {
                    type: 'array',
                    minItems: 2,
                    prefixItems: [
                        {
                            $ref: NODE_REF,
                            type: 'object',
                            properties: {
                                'unique-id': { const: 'web-app' },
                                'node-type': { const: 'webclient' },
                                name: { const: 'Web App' },
                                description: { const: 'Frontend' },
                                interfaces: {
                                    type: 'array',
                                    prefixItems: [
                                        {
                                            type: 'object',
                                            properties: {
                                                'unique-id': { const: 'web-port' },
                                                port: { const: 443 },
                                            },
                                        },
                                    ],
                                },
                                metadata: {
                                    type: 'object',
                                    properties: { owner: { const: 'team-a' } },
                                },
                            },
                        },
                        {
                            $ref: NODE_REF,
                            type: 'object',
                            properties: {
                                'unique-id': { const: 'api-svc' },
                                'node-type': { const: 'service' },
                                name: { const: 'API Service' },
                            },
                        },
                    ],
                },
                relationships: {
                    type: 'array',
                    minItems: 1,
                    prefixItems: [
                        {
                            $ref: RELATIONSHIP_REF,
                            type: 'object',
                            properties: {
                                'unique-id': { const: 'web-to-api' },
                                'relationship-type': {
                                    type: 'object',
                                    properties: {
                                        connects: {
                                            type: 'object',
                                            properties: {
                                                source: {
                                                    type: 'object',
                                                    properties: { node: { const: 'web-app' } },
                                                },
                                                destination: {
                                                    type: 'object',
                                                    properties: { node: { const: 'api-svc' } },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    ],
                },
            },
            required: ['nodes', 'relationships'],
        });
    });

    it('leaves out $schema, $id and type keys of nodes and nested objects', () => {
        const doc = {
            nodes: [
                {
                    'unique-id': 'n1',
                    $schema: 'x',
                    $id: 'y',
                    type: 'z',
                    metadata: { type: 'nested', keep: true },
                },
            ],
        };

        const pattern = JSON.parse(buildArchitecturePattern(doc, 'Keys').json);

        expect(pattern.properties.nodes.prefixItems[0].properties).toEqual({
            'unique-id': { const: 'n1' },
            metadata: { type: 'object', properties: { keep: { const: true } } },
        });
    });

    it('builds an empty pattern for an empty canvas', () => {
        const { fileName, json } = buildArchitecturePattern({}, 'Empty');
        const pattern = JSON.parse(json);

        expect(fileName).toBe('empty.pattern.json');
        expect(pattern.$schema).toBe(`${CALM_META_SCHEMA_BASE_URL}/calm.json`);
        expect(pattern.properties).toEqual({
            nodes: { type: 'array', minItems: 0, prefixItems: [] },
            relationships: { type: 'array', minItems: 0, prefixItems: [] },
        });
        expect(pattern.required).toEqual(['nodes', 'relationships']);
    });

    it('writes the pattern as JSON indented by two spaces', () => {
        const { json } = buildArchitecturePattern({ nodes: [], relationships: [] }, 'Format');

        expect(json).toBe(JSON.stringify(JSON.parse(json), null, 2));
    });
});
