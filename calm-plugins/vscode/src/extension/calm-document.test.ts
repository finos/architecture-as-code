import { describe, expect, it } from 'vitest';
import { hasCalmArchitectureContent, isCalmDocument } from './calm-document';

const architecture = JSON.stringify({
    $schema: 'https://calm.finos.org/release/1.2/meta/calm.json',
    nodes: [{ 'unique-id': 'api', 'node-type': 'service', name: 'API', description: 'API' }],
    relationships: [],
});

describe('hasCalmArchitectureContent', () => {
    it.each([
        ['nodes', { nodes: [] }],
        ['relationships', { relationships: [] }],
        ['flows', { flows: [] }],
        ['the CALM meta-schema only', { $schema: 'https://calm.finos.org/release/1.2/meta/calm.json' }],
    ])('accepts an architecture identified by %s', (_reason, document) => {
        expect(hasCalmArchitectureContent(JSON.stringify(document))).toBe(true);
    });

    it.each([
        ['invalid JSON', '{ not json'],
        ['a JSON array', '[]'],
        ['JSON without CALM keys', '{"name":"my-app","version":"1.0.0"}'],
        [
            'a pattern, whose nodes are a JSON Schema',
            JSON.stringify({
                $schema: 'https://json-schema.org/draft/2020-12/schema',
                properties: { nodes: { type: 'array' } },
            }),
        ],
        ['nodes that are not an array', '{"nodes":{"a":1}}'],
    ])('rejects %s', (_reason, text) => {
        expect(hasCalmArchitectureContent(text)).toBe(false);
    });
});

describe('isCalmDocument', () => {
    it('accepts a CALM architecture with any file name', () => {
        expect(isCalmDocument('/workspace/system.json', architecture)).toBe(true);
        expect(isCalmDocument('/repo/calm/architecture/calm-3.json', architecture)).toBe(true);
    });

    it('accepts a CALM suffix whatever the content, as before', () => {
        expect(isCalmDocument('/workspace/new.calm.json', '')).toBe(true);
    });

    it('rejects other JSON files', () => {
        expect(isCalmDocument('/workspace/package.json', '{"name":"x"}')).toBe(false);
    });
});
