import { describe, it, expect } from 'vitest';
import {
    buildControlRequirement,
    validateControlRequirementInput,
    isReservedPropertyName,
    slugify,
    type ControlRequirementInput,
} from './control-doc';
import { parseRequirementSchema } from '../../extension/services/requirement-parser';

const base: ControlRequirementInput = {
    slug: 'micro-segmentation',
    controlId: 'security-001',
    name: 'Micro-segmentation',
    description: 'Prevent lateral movement',
    properties: [],
};

describe('slugify', () => {
    it('converts a display name to lowercase kebab', () => {
        expect(slugify('Micro-segmentation of K8s Cluster')).toBe('micro-segmentation-of-k8s-cluster');
    });
});

describe('isReservedPropertyName', () => {
    it('flags base fields and schema keywords', () => {
        for (const n of ['control-id', 'name', 'description', 'type', '$defs', 'allOf']) {
            expect(isReservedPropertyName(n)).toBe(true);
        }
        expect(isReservedPropertyName('permit-ingress')).toBe(false);
    });
});

describe('buildControlRequirement', () => {
    it('emits a CALM 1.2 requirement with base consts, allOf ref, $id and type', () => {
        const { json, fileName, $id } = buildControlRequirement(base);
        const doc = JSON.parse(json);
        expect(doc.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
        expect(doc.$id).toBe('controls/micro-segmentation.requirement.json');
        expect($id).toBe(doc.$id);
        expect(doc.title).toBe('Micro-segmentation');
        expect(doc.type).toBe('object');
        expect(doc.allOf).toEqual([
            { $ref: 'https://calm.finos.org/release/1.2/meta/control-requirement.json' },
        ]);
        expect(doc.properties['control-id']).toEqual({ const: 'security-001' });
        expect(doc.properties.name).toEqual({ const: 'Micro-segmentation' });
        expect(doc.properties.description).toEqual({ const: 'Prevent lateral movement' });
        expect(doc.required).toEqual(['control-id', 'name', 'description']);
        expect(fileName).toBe('micro-segmentation.requirement.json');
    });

    it('adds typed custom properties and marks required ones', () => {
        const doc = JSON.parse(
            buildControlRequirement({
                ...base,
                properties: [
                    { name: 'permit-ingress', type: 'boolean', required: true },
                    { name: 'reason', type: 'string', required: false, pattern: '^.+$', description: 'why' },
                    { name: 'retries', type: 'integer', required: false },
                ],
            }).json
        );
        expect(doc.properties['permit-ingress']).toEqual({ type: 'boolean' });
        expect(doc.properties.reason).toEqual({ type: 'string', pattern: '^.+$', description: 'why' });
        expect(doc.properties.retries).toEqual({ type: 'integer' });
        expect(doc.required).toEqual(['control-id', 'name', 'description', 'permit-ingress']);
    });

    it('inlines small enums (<=3 values)', () => {
        const doc = JSON.parse(
            buildControlRequirement({
                ...base,
                properties: [{ name: 'level', type: 'enum', required: true, enumValues: ['low', 'high'] }],
            }).json
        );
        expect(doc.properties.level).toEqual({ enum: ['low', 'high'] });
        expect(doc.$defs).toBeUndefined();
    });

    it('emits large enums (>3 values) via $defs with a $ref', () => {
        const doc = JSON.parse(
            buildControlRequirement({
                ...base,
                properties: [
                    { name: 'protocol', type: 'enum', required: true, enumValues: ['HTTP', 'HTTPS', 'TLS', 'mTLS'] },
                ],
            }).json
        );
        expect(doc.properties.protocol).toEqual({ $ref: '#/$defs/protocol' });
        expect(doc.$defs.protocol).toEqual({ enum: ['HTTP', 'HTTPS', 'TLS', 'mTLS'] });
    });

    it('produces output that the requirement parser accepts', () => {
        const { json } = buildControlRequirement({
            ...base,
            properties: [
                { name: 'permit-ingress', type: 'boolean', required: true },
                { name: 'protocol', type: 'enum', required: true, enumValues: ['HTTP', 'HTTPS', 'TLS', 'mTLS'] },
            ],
        });
        const { parsed, warnings } = parseRequirementSchema(JSON.parse(json));
        expect(warnings).toEqual([]);
        expect(parsed?.identity.controlId).toBe('security-001');
        expect(parsed?.properties['permit-ingress'].type).toBe('boolean');
        expect(parsed?.properties.protocol).toEqual({
            type: 'enum',
            allowedValues: ['HTTP', 'HTTPS', 'TLS', 'mTLS'],
            description: undefined,
            required: true,
        });
    });
});

describe('validateControlRequirementInput', () => {
    it('accepts a valid input', () => {
        expect(validateControlRequirementInput(base)).toEqual([]);
    });

    it('rejects a bad slug', () => {
        expect(validateControlRequirementInput({ ...base, slug: 'Bad Slug' })).toContain(
            'Slug must be lowercase kebab-case (e.g. micro-segmentation)'
        );
    });

    it('rejects reserved property names', () => {
        const errors = validateControlRequirementInput({
            ...base,
            properties: [{ name: 'type', type: 'string', required: false }],
        });
        expect(errors.some((e) => e.includes('reserved'))).toBe(true);
    });

    it('rejects duplicate enum values and ignores empty segments', () => {
        const errors = validateControlRequirementInput({
            ...base,
            properties: [{ name: 'p', type: 'enum', required: true, enumValues: ['a', 'a', ''] }],
        });
        expect(errors.some((e) => e.includes('duplicate values'))).toBe(true);
        // Trailing empty segments (from a trailing comma while typing) are ignored, not errors.
        expect(errors.some((e) => e.includes('empty value'))).toBe(false);
    });

    it('normalizes raw comma input (trims + drops empties) when building enum', () => {
        const doc = JSON.parse(
            buildControlRequirement({
                ...base,
                properties: [
                    { name: 'level', type: 'enum', required: true, enumValues: ['low', ' high', ''] },
                ],
            }).json
        );
        expect(doc.properties.level).toEqual({ enum: ['low', 'high'] });
    });

    it('rejects an invalid regex pattern', () => {
        const errors = validateControlRequirementInput({
            ...base,
            properties: [{ name: 'p', type: 'string', required: false, pattern: '[' }],
        });
        expect(errors.some((e) => e.includes('invalid regex'))).toBe(true);
    });

    it('rejects duplicate property names', () => {
        const errors = validateControlRequirementInput({
            ...base,
            properties: [
                { name: 'p', type: 'string', required: false },
                { name: 'p', type: 'boolean', required: false },
            ],
        });
        expect(errors.some((e) => e.includes('Duplicate property'))).toBe(true);
    });
});
