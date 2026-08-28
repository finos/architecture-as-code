import { generate } from './generate-core';
import { SchemaDirectory } from '../../schema-directory';

describe('generate core', () => {
    it('returns the instantiated architecture object without touching the filesystem', async () => {
        const pattern = {
            $schema: 'https://json-schema.org/draft/2020-12/schema',
            $id: 'https://x/pattern.json',
            type: 'object',
            properties: {
                nodes: { type: 'array', prefixItems: [
                    { type: 'object', properties: { 'unique-id': { const: 'a' }, 'node-type': { const: 'service' }, name: { const: 'A' }, description: { const: 'd' } } }
                ] },
                relationships: { type: 'array', prefixItems: [] },
            },
        };
        const schemaDirectory = { loadSchemas: vi.fn(), getSchema: vi.fn(), getDefinition: vi.fn(), loadCurrentPatternAsSchema: vi.fn() } as unknown as SchemaDirectory;
        const result = await generate(pattern, schemaDirectory) as { nodes: { 'unique-id': string }[] };
        expect(schemaDirectory.loadSchemas).toHaveBeenCalled();
        expect(result.nodes[0]['unique-id']).toBe('a');
    });

    it('propagates errors instead of swallowing them', async () => {
        const schemaDirectory = { loadSchemas: vi.fn().mockRejectedValue(new Error('boom')) } as unknown as SchemaDirectory;
        await expect(generate({}, schemaDirectory)).rejects.toThrow('boom');
    });
});
