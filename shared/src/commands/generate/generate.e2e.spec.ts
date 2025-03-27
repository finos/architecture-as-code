import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runGenerate } from './generate';

vi.mock('../../consts', () => ({
    get CALM_META_SCHEMA_DIRECTORY() { return 'test_fixtures/calm'; }
}));

jest.mock('winston', () => ({
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn().mockImplementation((err) => console.error(err)),
    warn: jest.fn(),
    format: {
        colorize: jest.fn(),
        combine: jest.fn(),
        label: jest.fn(),
        timestamp: jest.fn(),
        printf: jest.fn(),
        cli: jest.fn(),
        errors: jest.fn()
    },
    createLogger: jest.fn().mockReturnValue({
        info: jest.fn(),
        debug: jest.fn(),
        error: jest.fn().mockImplementation((err) => console.error(err)),
        warn: jest.fn(),
    }),
    transports: {
        Console: jest.fn()
    }
}));

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
        const testPattern: object = JSON.parse(readFileSync(patternPath, { encoding: 'utf8' }));
        const outPath = path.join(tempDirectoryPath, 'output.json');
        await runGenerate(testPattern, outPath, true, false);

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