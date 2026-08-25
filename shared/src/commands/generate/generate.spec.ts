import { runGenerate } from './generate';
import { SchemaDirectory } from '../../schema-directory';
import { tmpdir } from 'node:os';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { setCalmSchema, TEST_ALL_SCHEMA } from '../../test/test-utils';

vi.mock('../../logger', () => {
    return {
        initLogger: () => {
            return {
                info: () => { },
                debug: () => { },
                error: () => { },
                warn: () => { }
            };
        }
    };
});

vi.mock('./components/instantiate', () => ({
    instantiate: vi.fn(function () { return Promise.resolve({
        nodes: [{ 'unique-id': 'mock-node' }],
        relationships: [{ 'unique-id': 'mock-rel' }],
        $schema: 'https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/pattern/api-gateway'
    }); })
}));

vi.mock('./components/flatten-allof', () => ({
    flattenAllOf: vi.fn(function (schema) { return Promise.resolve(schema); })
}));


describe('runGenerate', () => {
    let tempDirectoryPath: string;
    const testPath: string = 'test_fixtures/api-gateway.json';
    const testPattern: object = JSON.parse(readFileSync(testPath, { encoding: 'utf8' }));
    let schemaDirectory: SchemaDirectory;

    beforeEach(() => {
        tempDirectoryPath = mkdtempSync(path.join(tmpdir(), 'calm-test-'));
        schemaDirectory = {
            loadSchemas: vi.fn().mockResolvedValue(undefined)
        } as unknown as SchemaDirectory;
    });

    afterEach(() => {
        rmSync(tempDirectoryPath, { recursive: true, force: true });
    });

    it.each(TEST_ALL_SCHEMA)('instantiates to given directory', async (schemaVersion) => {
        const testPatternVersioned = setCalmSchema(testPattern, schemaVersion);
        const outPath = path.join(tempDirectoryPath, 'output.json');
        await runGenerate(testPatternVersioned, outPath, false, schemaDirectory, []);

        expect(existsSync(outPath))
            .toBeTruthy();
    });

    it.each(TEST_ALL_SCHEMA)('instantiates to given directory with nested folders', async (schemaVersion) => {
        const testPatternVersioned = setCalmSchema(testPattern, schemaVersion);
        const outPath = path.join(tempDirectoryPath, 'output/test/output.json');
        await runGenerate(testPatternVersioned, outPath, false, schemaDirectory, []);

        expect(existsSync(outPath))
            .toBeTruthy();
    });

    it.each(TEST_ALL_SCHEMA)('instantiates to calm architecture file', async (schemaVersion) => {
        const testPatternVersioned = setCalmSchema(testPattern, schemaVersion);
        const outPath = path.join(tempDirectoryPath, 'output.json');
        await runGenerate(testPatternVersioned, outPath, false, schemaDirectory, []);

        expect(existsSync(outPath))
            .toBeTruthy();

        const spec = readFileSync(outPath, { encoding: 'utf-8' });
        const parsed = JSON.parse(spec);
        expect(parsed)
            .toHaveProperty('nodes');
        expect(parsed)
            .toHaveProperty('relationships');
        expect(parsed)
            .toHaveProperty('$schema');
        expect(parsed['$schema'])
            .toEqual('https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/pattern/api-gateway');
    });

});

describe('generate core', () => {
    // The module-level vi.mock calls above replace instantiate/flattenAllOf for the whole file.
    // These tests need the real implementations, so unmock + reset modules before each dynamic import.
    beforeEach(() => {
        vi.doUnmock('./components/instantiate');
        vi.doUnmock('./components/flatten-allof');
        vi.resetModules();
    });

    it('returns the instantiated architecture object without touching the filesystem', async () => {
        const { generate } = await import('./generate-core');
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
        const { generate } = await import('./generate-core');
        const schemaDirectory = { loadSchemas: vi.fn().mockRejectedValue(new Error('boom')) } as unknown as SchemaDirectory;
        await expect(generate({}, schemaDirectory)).rejects.toThrow('boom');
    });
});
