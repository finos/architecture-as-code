import { describe, it, expect } from 'vitest';
import { parseRequirementSchema } from './requirement-parser';

const identity = {
    'control-id': { const: 'security-001' },
    name: { const: 'Micro-segmentation' },
    description: { const: 'Prevent lateral movement' },
};

describe('parseRequirementSchema', () => {
    it('extracts identity constants and multiple typed properties', () => {
        const { parsed, warnings } = parseRequirementSchema({
            properties: {
                ...identity,
                'permit-ingress': { type: 'boolean' },
                'max-connections': { type: 'integer' },
                weight: { type: 'number' },
                reason: { type: 'string', description: 'Why' },
            },
            required: ['control-id', 'name', 'description', 'permit-ingress'],
        });

        expect(warnings).toEqual([]);
        expect(parsed?.identity).toEqual({
            controlId: 'security-001',
            name: 'Micro-segmentation',
            description: 'Prevent lateral movement',
        });
        expect(parsed?.properties['permit-ingress']).toEqual({
            type: 'boolean',
            description: undefined,
            required: true,
        });
        expect(parsed?.properties['max-connections'].type).toBe('integer');
        expect(parsed?.properties.weight.type).toBe('number');
        expect(parsed?.properties.reason).toEqual({
            type: 'string',
            description: 'Why',
            required: false,
        });
    });

    it('reads inline enum arrays and preserves native value types', () => {
        const { parsed } = parseRequirementSchema({
            properties: {
                ...identity,
                level: { enum: ['low', 'high'] },
                retries: { enum: [1, 2, 3] },
            },
        });
        expect(parsed?.properties.level).toEqual({
            type: 'enum',
            allowedValues: ['low', 'high'],
            description: undefined,
            required: false,
        });
        expect(parsed?.properties.retries.allowedValues).toEqual([1, 2, 3]);
    });

    it('resolves a $ref to a local defs entry', () => {
        const { parsed } = parseRequirementSchema({
            properties: {
                ...identity,
                protocol: { $ref: '#/defs/protocol' },
            },
            required: ['protocol'],
            defs: { protocol: { enum: ['HTTP', 'HTTPS'] } },
        });
        expect(parsed?.properties.protocol).toEqual({
            type: 'enum',
            allowedValues: ['HTTP', 'HTTPS'],
            description: undefined,
            required: true,
        });
    });

    it('resolves a $ref to a $defs entry', () => {
        const { parsed } = parseRequirementSchema({
            properties: {
                ...identity,
                tier: { $ref: '#/$defs/tier' },
            },
            $defs: { tier: { type: 'string', pattern: '^T\\d$' } },
        });
        expect(parsed?.properties.tier).toEqual({
            type: 'string',
            pattern: '^T\\d$',
            description: undefined,
            required: false,
        });
    });

    it('captures a string pattern', () => {
        const { parsed } = parseRequirementSchema({
            properties: {
                ...identity,
                'app-id': { type: 'string', pattern: '^AP\\d+$' },
            },
        });
        expect(parsed?.properties['app-id'].pattern).toBe('^AP\\d+$');
    });

    it('defaults a typeless property to plain string', () => {
        const { parsed } = parseRequirementSchema({
            properties: { ...identity, note: { description: 'freeform' } },
        });
        expect(parsed?.properties.note.type).toBe('string');
    });

    it('honors the required array', () => {
        const { parsed } = parseRequirementSchema({
            properties: {
                ...identity,
                a: { type: 'string' },
                b: { type: 'string' },
            },
            required: ['a'],
        });
        expect(parsed?.properties.a.required).toBe(true);
        expect(parsed?.properties.b.required).toBe(false);
    });

    it('skips unsupported types and warns', () => {
        const { parsed, warnings } = parseRequirementSchema({
            properties: {
                ...identity,
                nested: { type: 'object' },
                list: { type: 'array' },
                external: { $ref: 'https://example.com/x.json' },
            },
        });
        expect(Object.keys(parsed?.properties ?? {})).toEqual([]);
        expect(warnings).toHaveLength(3);
        expect(warnings[0]).toContain('nested');
    });

    it('returns null with a warning when identity constants are missing', () => {
        const { parsed, warnings } = parseRequirementSchema({
            properties: {
                'control-id': { const: 'x' },
                name: { const: '' },
                description: { const: 'd' },
            },
        });
        expect(parsed).toBeNull();
        expect(warnings[0]).toContain('identity');
    });

    it('returns null for a non-object schema', () => {
        expect(parseRequirementSchema('nope').parsed).toBeNull();
        expect(parseRequirementSchema(null).parsed).toBeNull();
    });

    it('returns null when properties are absent', () => {
        const { parsed, warnings } = parseRequirementSchema({ type: 'object' });
        expect(parsed).toBeNull();
        expect(warnings[0]).toContain('properties');
    });

    it('uses fallback identity when const values are missing', () => {
        const fallback = { controlId: 'fb-id', name: 'Fallback', description: 'Fallback desc' };
        const { parsed, warnings } = parseRequirementSchema(
            { properties: { 'max-connections': { type: 'integer' } }, required: [] },
            fallback
        );
        expect(parsed).not.toBeNull();
        expect(parsed!.identity).toEqual(fallback);
        expect(parsed!.properties['max-connections']).toMatchObject({ type: 'integer' });
        expect(warnings.some((w) => w.includes('derived from control metadata'))).toBe(true);
    });

    it('merges partial const values with fallback identity', () => {
        const fallback = { controlId: 'fb-id', name: 'Fallback', description: 'Fallback desc' };
        const { parsed } = parseRequirementSchema(
            { properties: { ...identity, 'control-id': {} }, required: [] },
            fallback
        );
        expect(parsed!.identity.controlId).toBe('fb-id');
        expect(parsed!.identity.name).toBe('Micro-segmentation');
        expect(parsed!.identity.description).toBe('Prevent lateral movement');
    });

    it('returns null without fallback when identity constants are missing', () => {
        const { parsed } = parseRequirementSchema(
            { properties: { 'max-connections': { type: 'integer' } }, required: [] }
        );
        expect(parsed).toBeNull();
    });
});
