import { describe, it, expect } from 'vitest';
import {
    buildControlRequirement,
    validateControlRequirementInput,
    slugify,
    type ControlRequirementInput,
} from './control-doc';

describe('ControlCreator logic', () => {
    describe('slugify', () => {
        it('converts display name to slug', () => {
            expect(slugify('Resiliency Tier')).toBe('resiliency-tier');
        });

        it('strips non-alphanumeric characters', () => {
            expect(slugify('My Control! (v2)')).toBe('my-control-v2');
        });

        it('collapses multiple hyphens', () => {
            expect(slugify('foo   bar---baz')).toBe('foo-bar-baz');
        });

        it('trims leading and trailing hyphens', () => {
            expect(slugify('  --Hello World--  ')).toBe('hello-world');
        });
    });

    describe('validateControlRequirementInput', () => {
        const validInput: ControlRequirementInput = {
            slug: 'resiliency-tier',
            domain: 'platform',
            name: 'Resiliency Tier',
            description: 'Defines the resiliency tier',
            properties: [{ name: 'tier', type: 'string', required: true }],
        };

        it('returns no errors for valid input', () => {
            expect(validateControlRequirementInput(validInput)).toHaveLength(0);
        });

        it('requires slug', () => {
            const errors = validateControlRequirementInput({ ...validInput, slug: '' });
            expect(errors.some(e => e.toLowerCase().includes('slug'))).toBe(true);
        });

        it('requires name', () => {
            const errors = validateControlRequirementInput({ ...validInput, name: '' });
            expect(errors.some(e => e.toLowerCase().includes('name'))).toBe(true);
        });

        it('requires domain', () => {
            const errors = validateControlRequirementInput({ ...validInput, domain: '' });
            expect(errors.some(e => e.toLowerCase().includes('domain'))).toBe(true);
        });

        it('accepts zero properties', () => {
            const errors = validateControlRequirementInput({ ...validInput, properties: [] });
            expect(errors).toHaveLength(0);
        });

        it('requires property names', () => {
            const errors = validateControlRequirementInput({
                ...validInput,
                properties: [{ name: '', type: 'string', required: false }],
            });
            expect(errors.some(e => e.toLowerCase().includes('propert') && e.toLowerCase().includes('name'))).toBe(true);
        });
    });

    describe('buildControlRequirement', () => {
        it('produces valid JSON Schema for a control', () => {
            const input: ControlRequirementInput = {
                slug: 'resiliency-tier',
                domain: 'platform',
                name: 'Resiliency Tier',
                description: 'Defines the resiliency tier',
                properties: [
                    { name: 'tier', type: 'string', required: true },
                    { name: 'active', type: 'boolean', required: false },
                ],
            };

            const result = buildControlRequirement(input);
            const parsed = JSON.parse(result.json);

            expect(result.fileName).toContain('resiliency-tier');
            expect(parsed.title).toBe('Resiliency Tier');
            expect(parsed.description).toBe('Defines the resiliency tier');
            expect(parsed.properties.tier).toBeDefined();
            expect(parsed.properties.active).toBeDefined();
            expect(parsed.required).toContain('tier');
            expect(parsed.required).not.toContain('active');
        });

        it('includes enum values for enum properties', () => {
            const input: ControlRequirementInput = {
                slug: 'env-type',
                domain: 'infra',
                name: 'Environment Type',
                description: 'The environment classification',
                properties: [
                    { name: 'env', type: 'enum', required: true, enumValues: ['dev', 'staging', 'prod'] },
                ],
            };

            const result = buildControlRequirement(input);
            const parsed = JSON.parse(result.json);
            expect(parsed.properties.env.enum).toEqual(['dev', 'staging', 'prod']);
        });

        it('includes pattern for string properties with regex', () => {
            const input: ControlRequirementInput = {
                slug: 'naming',
                domain: 'platform',
                name: 'Naming Convention',
                description: 'Naming rules',
                properties: [
                    { name: 'prefix', type: 'string', required: true, pattern: '^[a-z]+-' },
                ],
            };

            const result = buildControlRequirement(input);
            const parsed = JSON.parse(result.json);
            expect(parsed.properties.prefix.pattern).toBe('^[a-z]+-');
        });
    });

    describe('name-to-slug auto-sync', () => {
        it('auto-generates slug from display name', () => {
            const name = 'Resiliency Tier';
            const slug = slugify(name);
            expect(slug).toBe('resiliency-tier');
        });
    });
});
