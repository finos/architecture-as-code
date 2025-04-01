import { runGenerate } from './generate';
import { tmpdir } from 'node:os';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

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

vi.mock('../../schema-directory');

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

    beforeEach(() => {
        tempDirectoryPath = mkdtempSync(path.join(tmpdir(), 'calm-test-'));
    });

    afterEach(() => {
        rmSync(tempDirectoryPath, { recursive: true, force: true });
    });

    it('instantiates to given directory', async () => {
        const outPath = path.join(tempDirectoryPath, 'output.json');
        await runGenerate(testPattern, outPath, false, false);

        expect(existsSync(outPath))
            .toBeTruthy();
    });

    it('instantiates to given directory with nested folders', async () => {
        const outPath = path.join(tempDirectoryPath, 'output/test/output.json');
        await runGenerate(testPattern, outPath, false, false);

        expect(existsSync(outPath))
            .toBeTruthy();
    });

    it('instantiates to calm architecture file', async () => {
        const outPath = path.join(tempDirectoryPath, 'output.json');
        await runGenerate(testPattern, outPath, false, false);

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
