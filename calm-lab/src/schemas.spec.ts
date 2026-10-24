import { describe, it, expect } from 'vitest';
import rootPackage from '../../package.json';
import { calmRelease, CALM_META_SCHEMA_BASE_URL, CALM_SCHEMA_RELEASE, SCHEMAS } from './schemas';
import { generateArchitecture, validateOutcome } from './engine';

const PINNED_RELEASES = [...new Set(
    Object.entries(rootPackage.devDependencies as Record<string, string>)
        .filter(([name, spec]) => name === '@finos/calm-schema' || spec.startsWith('npm:@finos/calm-schema@'))
        .map(([, spec]) => /(\d+\.\d+)\.\d+$/.exec(spec)?.[1] ?? spec),
)].sort();

const meta = (release: string, file: string) => `https://calm.finos.org/release/${release}/meta/${file}`;

const patternFor = (release: string) => ({
    $schema: meta(release, 'calm.json'),
    $id: `https://calm.example.com/patterns/${release}.json`,
    type: 'object',
    properties: {
        nodes: {
            type: 'array',
            minItems: 1,
            maxItems: 1,
            prefixItems: [{
                $ref: `${meta(release, 'core.json')}#/defs/node`,
                properties: { 'unique-id': { const: 'svc' }, 'node-type': { const: 'service' } },
            }],
        },
        relationships: { type: 'array' },
    },
    required: ['nodes', 'relationships'],
});

describe('bundled release schemas', () => {
    it('finds the pinned releases in the root package.json', () => {
        expect(PINNED_RELEASES).toEqual(expect.arrayContaining(['1.0', '1.1', '1.2', '1.3']));
    });

    it.each(PINNED_RELEASES)('bundles the %s release', (release) => {
        expect(Object.keys(SCHEMAS)).toEqual(expect.arrayContaining([meta(release, 'calm.json'), meta(release, 'core.json')]));
    });

    it.each(PINNED_RELEASES)('generates from a pattern that refs the %s release', async (release) => {
        const architecture = await generateArchitecture(patternFor(release)) as { nodes: Array<Record<string, unknown>> };

        expect(architecture.nodes[0]).toMatchObject({ 'unique-id': 'svc', 'node-type': 'service' });
    });

    it.each(PINNED_RELEASES)('validates against a pattern that refs the %s release', async (release) => {
        const node = { 'unique-id': 'svc', 'node-type': 'service', name: 'Service', description: 'a service' };

        const valid = await validateOutcome({ nodes: [node], relationships: [] }, patternFor(release));
        const missingDescription = await validateOutcome({ nodes: [{ ...node, description: undefined }], relationships: [] }, patternFor(release));

        expect(valid.hasErrors).toBe(false);
        expect(missingDescription.jsonSchemaValidationOutputs).toEqual([
            expect.objectContaining({ path: '/nodes/0', message: expect.stringContaining('description') }),
        ]);
    });
});

describe('CALM_SCHEMA_RELEASE', () => {
    it('is the release of the @finos/calm-schema that the root package.json pins', () => {
        const pinned = /^(\d+\.\d+)\.\d+$/.exec(rootPackage.devDependencies['@finos/calm-schema'])?.[1];

        expect(CALM_SCHEMA_RELEASE).toBe(pinned);
        expect(CALM_META_SCHEMA_BASE_URL).toBe(`https://calm.finos.org/release/${CALM_SCHEMA_RELEASE}/meta`);
        expect(Object.keys(SCHEMAS)).toContain(`${CALM_META_SCHEMA_BASE_URL}/calm.json`);
    });

    it('reads the release from a calm.json $id', () => {
        expect(calmRelease('https://calm.finos.org/release/1.3/meta/calm.json')).toBe('1.3');
        expect(calmRelease('https://calm.finos.org/release/2.10/meta/calm.json')).toBe('2.10');
    });

    it.each([
        undefined,
        'https://calm.finos.org/draft/2025-03/meta/calm.json',
        'https://calm.finos.org/release/1.3/meta/core.json',
    ])('throws for %s', (id) => {
        expect(() => calmRelease(id)).toThrow('is not a CALM release calm.json $id');
    });
});
