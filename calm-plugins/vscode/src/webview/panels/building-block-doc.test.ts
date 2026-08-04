import { describe, it, expect } from 'vitest';
import {
    buildBuildingBlockDoc,
    generateId,
    type ControlEntry,
} from './building-block-doc';

describe('generateId', () => {
    it('slugifies names to lowercase kebab-case', () => {
        expect(generateId('API Gateway')).toBe('api-gateway');
        expect(generateId('  Payments  Service ')).toBe('payments-service');
        expect(generateId('TLS1.3 Policy!')).toBe('tls1-3-policy');
    });
});

describe('buildBuildingBlockDoc', () => {
    it('builds a CALM document and file name for a node with no controls', () => {
        const { json, fileName } = buildBuildingBlockDoc({
            name: 'API Gateway',
            nodeType: 'service',
            description: 'Edge gateway',
            controls: [],
        });

        expect(fileName).toBe('api-gateway.calm.json');
        const doc = JSON.parse(json);
        expect(doc.$schema).toContain('calm.finos.org');
        expect(doc.nodes).toHaveLength(1);
        expect(doc.nodes[0]).toMatchObject({
            'unique-id': 'building-block-api-gateway',
            'node-type': 'service',
            name: 'API Gateway',
            description: 'Edge gateway',
            metadata: { 'building-block-type': 'infrastructure' },
        });
        expect(doc.nodes[0].controls).toEqual({});
        expect(doc.relationships).toEqual([]);
    });

    it('emits a control with a requirement and no validation metadata when type is none', () => {
        const controls: ControlEntry[] = [
            {
                id: 'tls',
                description: 'Require TLS',
                requirementUrl: 'standards/tls-policy.md',
                validation: { type: 'none' },
            },
        ];
        const { json } = buildBuildingBlockDoc({
            name: 'Svc',
            nodeType: 'service',
            description: '',
            controls,
        });
        const control = JSON.parse(json).nodes[0].controls.tls;

        expect(control.description).toBe('Require TLS');
        expect(control.requirements[0]['requirement-url']).toBe(
            'standards/tls-policy.md'
        );
        expect(control.metadata).toBeUndefined();
    });

    it('emits pattern validation metadata (with example) under metadata.validation', () => {
        const controls: ControlEntry[] = [
            {
                id: 'tls',
                description: 'TLS version',
                requirementUrl: '',
                validation: {
                    type: 'pattern',
                    pattern: '^TLS1\\.[23]$',
                    example: 'TLS1.3',
                },
            },
        ];
        const { json } = buildBuildingBlockDoc({
            name: 'Svc',
            nodeType: 'service',
            description: '',
            controls,
        });
        const validation =
            JSON.parse(json).nodes[0].controls.tls.metadata.validation;

        expect(validation).toEqual({
            pattern: '^TLS1\\.[23]$',
            example: 'TLS1.3',
        });
    });

    it('emits allowed-values validation metadata', () => {
        const controls: ControlEntry[] = [
            {
                id: 'tls',
                description: 'TLS version',
                requirementUrl: '',
                validation: {
                    type: 'allowed-values',
                    allowedValues: ['TLS1.2', 'TLS1.3'],
                },
            },
        ];
        const { json } = buildBuildingBlockDoc({
            name: 'Svc',
            nodeType: 'service',
            description: '',
            controls,
        });
        const validation =
            JSON.parse(json).nodes[0].controls.tls.metadata.validation;

        expect(validation).toEqual({ 'allowed-values': ['TLS1.2', 'TLS1.3'] });
    });

    it('derives a control id from its description when id is blank', () => {
        const controls: ControlEntry[] = [
            {
                id: '',
                description: 'Encryption At Rest',
                requirementUrl: '',
                validation: { type: 'none' },
            },
        ];
        const { json } = buildBuildingBlockDoc({
            name: 'Svc',
            nodeType: 'service',
            description: '',
            controls,
        });
        expect(Object.keys(JSON.parse(json).nodes[0].controls)).toEqual([
            'encryption-at-rest',
        ]);
    });
});
