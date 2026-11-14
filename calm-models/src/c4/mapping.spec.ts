import { describe, expect, it, vi } from 'vitest';
import { CALM_DEFAULT_C4_MAPPING_URL, checkC4Mapping, resolveC4Mapping } from './mapping.js';

describe('resolveC4Mapping', () => {
    it('uses the default mapping when no mapping is set', async () => {
        const mapping = await resolveC4Mapping();

        expect(mapping['unique-id']).toBe('calm-default-c4-mapping');
        expect(mapping.nesting).toBe('demote');
        expect(mapping['node-types'].actor).toEqual({ kind: 'person', external: false, source: 'default' });
        expect(mapping['node-types'].network).toEqual({ kind: 'deployment-node', external: false, source: 'default' });
    });

    it('replaces the default mapping when the mapping does not extend it', async () => {
        const mapping = await resolveC4Mapping({ 'unique-id': 'only-aws', 'node-types': { 'aws:lambda': 'container' } });

        expect(Object.keys(mapping['node-types'])).toEqual(['aws:lambda']);
        expect(mapping['node-types']['aws:lambda'].source).toBe('mapping');
    });

    it('replaces the default entries per node type and keeps the others when it extends the default', async () => {
        const mapping = await resolveC4Mapping({
            'unique-id': 'acme',
            extends: CALM_DEFAULT_C4_MAPPING_URL,
            'node-types': { database: 'hidden', 'acme:vendor': { kind: 'software-system', external: true } },
        });

        expect(mapping['node-types'].database).toEqual({ kind: 'hidden', external: false, source: 'mapping' });
        expect(mapping['node-types']['acme:vendor']).toEqual({ kind: 'software-system', external: true, source: 'mapping' });
        expect(mapping['node-types'].service).toEqual({ kind: 'container', external: false, source: 'default' });
        expect(mapping.nesting).toBe('demote');
    });

    it('loads a chain of mappings and inherits nesting from the nearest mapping that sets it', async () => {
        const team = { 'unique-id': 'team', extends: 'https://example.com/org.json', 'node-types': { service: 'component' } };
        const org = {
            'unique-id': 'org',
            extends: CALM_DEFAULT_C4_MAPPING_URL,
            nesting: 'strict',
            'node-types': { service: 'software-system', 'aws:rds': 'container' },
        };
        const load = vi.fn(async () => org);

        const mapping = await resolveC4Mapping(team, load);

        expect(load).toHaveBeenCalledExactlyOnceWith('https://example.com/org.json');
        expect(mapping['unique-id']).toBe('team');
        expect(mapping.nesting).toBe('strict');
        expect(mapping['node-types'].service.kind).toBe('component');
        expect(mapping['node-types']['aws:rds'].kind).toBe('container');
        expect(mapping['node-types'].actor.kind).toBe('person');
    });

    it('stops on a cycle of extends', async () => {
        const a = { 'unique-id': 'a', extends: 'https://example.com/b.json' };
        const b = { 'unique-id': 'b', extends: 'https://example.com/a.json' };
        const load = async (url: string) => (url.endsWith('a.json') ? a : b);

        await expect(resolveC4Mapping(a, load)).rejects.toThrow(/extends itself/);
    });

    it('stops when a mapping that it extends does not load, and does not use the default mapping instead', async () => {
        const load = async () => {
            throw new Error('404 Not Found');
        };

        await expect(resolveC4Mapping({ 'unique-id': 'a', extends: 'https://example.com/b.json' }, load)).rejects.toThrow(
            'Cannot load https://example.com/b.json, which the C4 mapping a extends: 404 Not Found'
        );
    });

    it('uses demote when no mapping in the chain sets nesting', async () => {
        const org = { 'unique-id': 'org', 'node-types': { 'acme:app': 'container' } };

        const mapping = await resolveC4Mapping({ 'unique-id': 'team', extends: 'https://example.com/org.json' }, async () => org);

        expect(mapping.nesting).toBe('demote');
    });

    it('needs a loader for an extends URL other than the default', async () => {
        await expect(resolveC4Mapping({ 'unique-id': 'a', extends: 'https://example.com/b.json' })).rejects.toThrow(
            'Cannot load https://example.com/b.json, which the C4 mapping a extends'
        );
    });
});

describe('checkC4Mapping', () => {
    it.each([
        ['an array', [], /not a JSON object/],
        ['a missing unique-id', { 'node-types': {} }, /"unique-id"/],
        ['an empty unique-id', { 'unique-id': '' }, /"unique-id"/],
        ['an unknown field', { 'unique-id': 'a', name: 'x' }, /"name" is not a mapping field/],
        ['a relative extends', { 'unique-id': 'a', extends: 'default.json' }, /"extends" must be an absolute URI/],
        ['an unknown nesting', { 'unique-id': 'a', nesting: 'flatten' }, /"nesting"/],
        ['node-types that is not an object', { 'unique-id': 'a', 'node-types': ['service'] }, /"node-types"/],
        ['an empty node type', { 'unique-id': 'a', 'node-types': { '': 'container' } }, /must not be empty/],
        ['an unknown kind', { 'unique-id': 'a', 'node-types': { service: 'microservice' } }, /"service" must map to one of/],
        ['an entry with no kind', { 'unique-id': 'a', 'node-types': { service: { external: true } } }, /"service" must map/],
        ['an unknown entry field', { 'unique-id': 'a', 'node-types': { service: { kind: 'container', tech: 'Java' } } }, /"tech"/],
        ['a non-boolean external', { 'unique-id': 'a', 'node-types': { service: { kind: 'container', external: 'yes' } } }, /"external"/],
        ['an external hidden type', { 'unique-id': 'a', 'node-types': { x: { kind: 'hidden', external: true } } }, /"x" can be external only/],
        ['an external deployment node', { 'unique-id': 'a', 'node-types': { x: { kind: 'deployment-node', external: true } } }, /"x" can be external only/],
    ])('rejects %s', (_, value, message) => {
        expect(() => checkC4Mapping(value)).toThrow(message);
    });

    it('accepts every field of the schema', () => {
        const document = {
            $schema: 'https://calm.finos.org/standards/c4/1.0/c4-mapping.json',
            $id: 'https://example.com/acme.json',
            'unique-id': 'acme',
            description: 'Acme types',
            extends: CALM_DEFAULT_C4_MAPPING_URL,
            'node-types': { 'acme:module': 'component', 'acme:vendor': { kind: 'software-system', external: true } },
            nesting: 'strict',
        };

        expect(checkC4Mapping(document)).toBe(document);
    });
});
