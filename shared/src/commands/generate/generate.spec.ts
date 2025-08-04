import { runGenerate } from './generate';
import { tmpdir } from 'node:os';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { SchemaDirectory } from '../../schema-directory.js';

vi.mock('../../logger', () => {
    return {
        initLogger: () => {
            return {
                info: () => {},
                debug: () => {}
            };
        }
    };
});

vi.mock('../../consts', () => ({
    get CALM_META_SCHEMA_DIRECTORY() { return '../calm/draft/2025-03/meta'; }
}));

vi.mock('./components/instantiate', () => ({
    instantiate: vi.fn(() => Promise.resolve({
        nodes: [{ 'unique-id': 'mock-node' }],
        relationships: [{ 'unique-id': 'mock-rel' }],
        $schema: 'https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/pattern/api-gateway'
    }))
}));


describe('runGenerate', () => {
    let tempDirectoryPath;
    const testPath: string = 'test_fixtures/api-gateway.json';
    const testPattern: object = JSON.parse(readFileSync(testPath, { encoding: 'utf8' }));
    let schemaDirectory;

    beforeEach(() => {
        tempDirectoryPath = mkdtempSync(path.join(tmpdir(), 'calm-test-'));
        schemaDirectory = vi.mocked(SchemaDirectory);
    });

    afterEach(() => {
        rmSync(tempDirectoryPath, { recursive: true, force: true });
    });

    it('instantiates to given directory', async () => {
        const outPath = path.join(tempDirectoryPath, 'output.json');
        await runGenerate(testPattern, outPath, false, schemaDirectory, []);

        expect(existsSync(outPath))
            .toBeTruthy();
    });

    it('instantiates to given directory with nested folders', async () => {
        const outPath = path.join(tempDirectoryPath, 'output/test/output.json');
        await runGenerate(testPattern, outPath, false, schemaDirectory, []);

        expect(existsSync(outPath))
            .toBeTruthy();
    });

    it('instantiates to calm architecture file', async () => {
        const outPath = path.join(tempDirectoryPath, 'output.json');
        await runGenerate(testPattern, outPath, false, schemaDirectory, []);

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
