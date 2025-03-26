import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runGenerate } from './generate';

vi.mock('../../consts', () => ({
    get CALM_META_SCHEMA_DIRECTORY() { return 'test_fixtures/calm'; }
}));

vi.mock('../../logger', () => {
    return {
        initLogger: () => {
            return {
                info: () => {},
                warn: () => {},
                debug: () => {}
            };
        }
    };
});

describe('generate spec e2e', () => {
    let tempDirectoryPath;

    beforeEach(() => {
        tempDirectoryPath = mkdtempSync(path.join(tmpdir(), 'calm-test-'));
    });

    afterEach(() => {
        rmSync(tempDirectoryPath, { recursive: true, force: true });
    });

    it('instantiate file with self-reference', async () => {
        const patternPath = 'test_fixtures/api-gateway-self-reference.json';
        const outPath = path.join(tempDirectoryPath, 'output.json');
        await runGenerate(patternPath, outPath, true, false);

        expect(existsSync(outPath))
            .toBeTruthy();

        const spec = readFileSync(outPath, { encoding: 'utf-8' });
        const parsed = JSON.parse(spec);
        expect(parsed)
            .toHaveProperty('nodes');
        expect(parsed)
            .toHaveProperty('relationships');


        expect(parsed['nodes'][0]).toHaveProperty('extra-prop');
        expect(parsed['nodes'][0]['interfaces'][0]).toHaveProperty('extra-prop-interface');
    });
});