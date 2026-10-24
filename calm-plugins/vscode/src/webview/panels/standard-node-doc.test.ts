import { describe, it, expect } from 'vitest';
import {
    buildStandardNodeDoc,
    generateId,
    type AttachedControl,
} from './standard-node-doc';
import type { ParsedRequirement } from '../../extension/services/requirement-parser';
import { CALM_META_SCHEMA_BASE_URL } from '../../core/calm-schema-release';

const parsed: ParsedRequirement = {
    identity: {
        controlId: 'security-001',
        name: 'Micro-segmentation',
        description: 'Prevent lateral movement',
    },
    properties: {
        'permit-ingress': { type: 'boolean', required: true },
    },
};

describe('generateId', () => {
    it('slugifies names to lowercase kebab-case', () => {
        expect(generateId('API Gateway')).toBe('api-gateway');
        expect(generateId('  Payments  Service ')).toBe('payments-service');
        expect(generateId('TLS1.3 Policy!')).toBe('tls1-3-policy');
    });
});

describe('buildStandardNodeDoc', () => {
    it('builds a CALM document and file name for a node with no controls', () => {
        const { json, fileName } = buildStandardNodeDoc({
            name: 'API Gateway',
            nodeType: 'service',
            description: 'Edge gateway',
            controls: [],
        });

        expect(fileName).toBe('api-gateway.calm.json');
        const doc = JSON.parse(json);
        expect(doc.$schema).toBe(`${CALM_META_SCHEMA_BASE_URL}/core.json`);
        expect(doc.nodes).toHaveLength(1);
        expect(doc.nodes[0]).toMatchObject({
            'unique-id': 'standard-node-api-gateway',
            'node-type': 'service',
            name: 'API Gateway',
            description: 'Edge gateway',
            metadata: { 'standard-node-type': 'infrastructure' },
        });
        expect(doc.nodes[0].controls).toEqual({});
        expect(doc.relationships).toEqual([]);
    });

    it('emits a Hub CURIE control as a slim reference (no config or metadata)', () => {
        const controls: AttachedControl[] = [
            { ref: 'security:controls:micro-segmentation@1.0.0', parsed },
        ];
        const { json } = buildStandardNodeDoc({
            name: 'Svc',
            nodeType: 'service',
            description: '',
            controls,
        });
        const map = JSON.parse(json).nodes[0].controls;
        const control = map['security--micro-segmentation'];
        expect(control.description).toBeUndefined();
        expect(control.requirements[0]['requirement-url']).toBe(
            'security:controls:micro-segmentation@1.0.0'
        );
        expect(control.requirements[0].config).toBeUndefined();
        expect(control.metadata).toBeUndefined();
    });

    it('emits a local path control with the file-stem key', () => {
        const controls: AttachedControl[] = [
            { ref: 'controls/micro-segmentation.requirement.json', parsed },
        ];
        const { json } = buildStandardNodeDoc({
            name: 'Svc',
            nodeType: 'service',
            description: '',
            controls,
        });
        const map = JSON.parse(json).nodes[0].controls;
        expect(Object.keys(map)).toEqual(['micro-segmentation']);
        expect(map['micro-segmentation'].requirements[0]['requirement-url']).toBe(
            'controls/micro-segmentation.requirement.json'
        );
    });
});
