import { runGenerate } from './generate';
import { tmpdir } from 'node:os';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

jest.mock('../helper', () => {
    return {
        initLogger: () => {
            return {
                info: () => {},
                debug: () => {}
            };
        }
    };
});

jest.mock('./schema-directory');

jest.mock('../../consts', () => ({
    get CALM_META_SCHEMA_DIRECTORY() { return '../calm/draft/2024-04/meta'; }
}));


describe('runGenerate', () => {
    let tempDirectoryPath;
    const testPath: string = 'test_fixtures/api-gateway.json';

    beforeEach(() => {
        tempDirectoryPath = mkdtempSync(path.join(tmpdir(), 'calm-test-'));
    });

    afterEach(() => {
        rmSync(tempDirectoryPath, { recursive: true, force: true });
    });

    it('instantiates to given directory', async () => {
        const outPath = path.join(tempDirectoryPath, 'output.json');
        await runGenerate(testPath, outPath, false, false);

        expect(existsSync(outPath))
            .toBeTruthy();
    });

    it('instantiates to given directory with nested folders', async () => {
        const outPath = path.join(tempDirectoryPath, 'output/test/output.json');
        await runGenerate(testPath, outPath, false, false);

        expect(existsSync(outPath))
            .toBeTruthy();
    });

    it('instantiates to calm instantiation file', async () => {
        const outPath = path.join(tempDirectoryPath, 'output.json');
        await runGenerate(testPath, outPath, false, false);

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
