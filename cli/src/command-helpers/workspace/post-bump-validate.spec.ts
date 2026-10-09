import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import path from 'path';

// vi.mock is hoisted to the top of the file by vitest, so factories must not reference
// variables declared in the module scope. We store captured spies via vi.hoisted() instead.
const { mockValidate, mockLoadSchemas, mockLoadPattern, mockBuildDocumentLoader, mockParseDocumentLoaderConfig } = vi.hoisted(() => ({
    mockValidate: vi.fn(),
    mockLoadSchemas: vi.fn().mockResolvedValue(undefined),
    mockLoadPattern: vi.fn().mockResolvedValue(undefined),
    mockBuildDocumentLoader: vi.fn().mockReturnValue({}),
    mockParseDocumentLoaderConfig: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../document-loader-config', () => ({
    parseDocumentLoaderConfig: (...args: unknown[]) => mockParseDocumentLoaderConfig(...args),
}));

vi.mock('@finos/calm-shared', () => ({
    CALM_META_SCHEMA_DIRECTORY: '/mock/schema/dir',
    buildDocumentLoader: (...args: unknown[]) => mockBuildDocumentLoader(...args),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SchemaDirectory: vi.fn().mockImplementation(function(this: any) { this.loadSchemas = mockLoadSchemas; }),
    validate: (...args: unknown[]) => mockValidate(...args),
    loadPatternFromDocumentIfPresent: (...args: unknown[]) => mockLoadPattern(...args),
    initLogger: vi.fn().mockReturnValue({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import { runPostBumpValidation } from './post-bump-validate';

// Build a minimal ValidationOutcome-like object for the mocked validate function.
const makeOutcome = (errors: number) => ({
    hasErrors: errors > 0,
    hasWarnings: false,
    jsonSchemaValidationOutputs: Array.from({ length: errors }, () => ({ severity: 'error', message: 'err', code: 'E', path: '/', source: 'architecture' })),
    spectralSchemaValidationOutputs: [],
    allValidationOutputs() {
        return [...this.jsonSchemaValidationOutputs, ...this.spectralSchemaValidationOutputs];
    },
});

describe('runPostBumpValidation', () => {
    const bundlePath = path.join(__dirname, 'test-post-bump-validate');
    const filesPath = path.join(bundlePath, 'files');

    beforeEach(async () => {
        vi.clearAllMocks();
        mockLoadSchemas.mockResolvedValue(undefined);
        mockLoadPattern.mockResolvedValue(undefined);
        mockBuildDocumentLoader.mockReturnValue({});
        mockParseDocumentLoaderConfig.mockResolvedValue({});
        await mkdir(filesPath, { recursive: true });
    });

    afterEach(async () => {
        await rm(bundlePath, { recursive: true, force: true });
    });

    const write = (name: string, obj: object) =>
        writeFile(path.join(filesPath, name), JSON.stringify(obj), 'utf8');

    const archManifest = { 'my-arch': { path: 'files/arch.json', type: 'architecture' } };

    it('loads documents with the same user config that calm validate uses', async () => {
        // Without it a pattern on CalmHub could not be fetched, and every architecture derived
        // from one was reported as "could not validate" whether or not it conformed.
        const authPlugin = { getAuthHeaders: vi.fn() };
        mockParseDocumentLoaderConfig.mockResolvedValue({ calmHubUrl: 'https://hub.example.com', authPlugin });

        await runPostBumpValidation(bundlePath, archManifest);

        expect(mockBuildDocumentLoader).toHaveBeenCalledWith(expect.objectContaining({
            calmHubUrl: 'https://hub.example.com',
            authPlugin,
            schemaDirectoryPath: '/mock/schema/dir',
            workspaceBundlePath: bundlePath,
        }));
    });

    it('passes the CalmHub options and the bundle path to the config', async () => {
        const authPlugin = { getAuthHeaders: vi.fn() };

        await runPostBumpValidation(bundlePath, archManifest, { calmHubUrl: 'https://override.example.com', authPlugin });

        expect(mockParseDocumentLoaderConfig).toHaveBeenCalledWith({
            calmHubUrl: 'https://override.example.com',
            authPlugin,
            workspaceBundlePath: bundlePath,
        });
    });

    it('keeps the bundle as base path and debug off, whatever the config returns', async () => {
        mockParseDocumentLoaderConfig.mockResolvedValue({ basePath: '/elsewhere', debug: true, workspaceBundlePath: '/other' });

        await runPostBumpValidation(bundlePath, archManifest);

        expect(mockBuildDocumentLoader).toHaveBeenCalledWith(expect.objectContaining({
            basePath: bundlePath,
            debug: false,
            workspaceBundlePath: bundlePath,
        }));
    });

    it('does not load the config when no architecture or pattern is tracked', async () => {
        const results = await runPostBumpValidation(bundlePath, {
            'my-standard': { path: 'files/std.json', type: 'standard' },
        });

        expect(results).toEqual([]);
        expect(mockParseDocumentLoaderConfig).not.toHaveBeenCalled();
        expect(mockBuildDocumentLoader).not.toHaveBeenCalled();
    });

    it('returns passed:true for an architecture that validates without errors', async () => {
        await write('arch.json', { $id: 'test', title: 'Arch' });
        mockValidate.mockResolvedValue(makeOutcome(0));

        const results = await runPostBumpValidation(bundlePath, {
            'my-arch': { path: 'files/arch.json', type: 'architecture' },
        });

        expect(results).toHaveLength(1);
        expect(results[0]).toMatchObject({ id: 'my-arch', type: 'architecture', passed: true, errorCount: 0 });
    });

    it('returns passed:false with errorCount for an architecture that has errors', async () => {
        await write('arch.json', { $id: 'test', title: 'Arch' });
        mockValidate.mockResolvedValue(makeOutcome(3));

        const results = await runPostBumpValidation(bundlePath, {
            'my-arch': { path: 'files/arch.json', type: 'architecture' },
        });

        expect(results[0]).toMatchObject({ passed: false, errorCount: 3 });
    });

    it('calls validate with pattern slot for a pattern entry', async () => {
        await write('pat.json', { $id: 'test', title: 'Pat' });
        mockValidate.mockResolvedValue(makeOutcome(0));

        await runPostBumpValidation(bundlePath, {
            'my-pattern': { path: 'files/pat.json', type: 'pattern' },
        });

        // validate(undefined, patternContent, undefined, schemaDir, false) — pattern is 2nd arg
        expect(mockValidate).toHaveBeenCalledWith(
            undefined,
            expect.objectContaining({ $id: 'test' }),
            undefined,
            expect.anything(),
            false
        );
    });

    it('resolves the architecture pattern via $schema and validates against it', async () => {
        // Regression guard: an architecture must be validated against its own pattern
        // (architecture-with-pattern mode), not architecture-only, otherwise pattern drift
        // introduced by a bump goes undetected.
        await write('arch.json', { $id: 'test', title: 'Arch', $schema: 'https://example.com/pattern' });
        const pattern = { $id: 'https://example.com/pattern', title: 'Pattern' };
        mockLoadPattern.mockResolvedValue(pattern);
        mockValidate.mockResolvedValue(makeOutcome(0));

        await runPostBumpValidation(bundlePath, {
            'my-arch': { path: 'files/arch.json', type: 'architecture' },
        });

        // The pattern resolved from $schema is passed as the 2nd validate() argument.
        expect(mockLoadPattern).toHaveBeenCalledWith(
            expect.objectContaining({ $schema: 'https://example.com/pattern' }),
            expect.stringContaining('arch.json'),
            expect.anything(),
            expect.anything(),
            expect.anything()
        );
        expect(mockValidate).toHaveBeenCalledWith(
            expect.objectContaining({ $id: 'test' }),
            pattern,
            undefined,
            expect.anything(),
            false
        );
    });

    it('validates architecture-only when no pattern can be resolved from $schema', async () => {
        await write('arch.json', { $id: 'test', title: 'Arch' });
        mockLoadPattern.mockResolvedValue(undefined);
        mockValidate.mockResolvedValue(makeOutcome(0));

        await runPostBumpValidation(bundlePath, {
            'my-arch': { path: 'files/arch.json', type: 'architecture' },
        });

        // Falls back to architecture-only (pattern arg undefined) when there is no pattern to load.
        expect(mockValidate).toHaveBeenCalledWith(
            expect.objectContaining({ $id: 'test' }),
            undefined,
            undefined,
            expect.anything(),
            false
        );
    });

    it('skips non-architecture and non-pattern document types', async () => {
        mockValidate.mockResolvedValue(makeOutcome(0));

        const results = await runPostBumpValidation(bundlePath, {
            'my-flow': { path: 'files/flow.json', type: 'flow' },
            'my-adr': { path: 'files/adr.json', type: 'adr' },
            'my-timeline': { path: 'files/tl.json', type: 'timeline' },
        });

        expect(results).toHaveLength(0);
        expect(mockValidate).not.toHaveBeenCalled();
    });

    it('returns passed:false with errorCount:-1 when a file cannot be read', async () => {
        const results = await runPostBumpValidation(bundlePath, {
            'missing': { path: 'files/does-not-exist.json', type: 'architecture' },
        });

        expect(results).toHaveLength(1);
        expect(results[0]).toMatchObject({ id: 'missing', passed: false, errorCount: -1 });
        expect(mockValidate).not.toHaveBeenCalled();
    });

    it('returns passed:false with errorCount:-1 when validate throws', async () => {
        await write('arch.json', { $id: 'test', title: 'Arch' });
        mockValidate.mockRejectedValue(new Error('schema load failure'));

        const results = await runPostBumpValidation(bundlePath, {
            'my-arch': { path: 'files/arch.json', type: 'architecture' },
        });

        expect(results[0]).toMatchObject({ passed: false, errorCount: -1 });
    });

    it('processes multiple docs and reports each independently', async () => {
        await write('a.json', { $id: 'a', title: 'A' });
        await write('b.json', { $id: 'b', title: 'B' });
        mockValidate
            .mockResolvedValueOnce(makeOutcome(0))  // a passes
            .mockResolvedValueOnce(makeOutcome(2));  // b fails

        const results = await runPostBumpValidation(bundlePath, {
            'a': { path: 'files/a.json', type: 'architecture' },
            'b': { path: 'files/b.json', type: 'pattern' },
        });

        expect(results).toHaveLength(2);
        expect(results.find(r => r.id === 'a')).toMatchObject({ passed: true });
        expect(results.find(r => r.id === 'b')).toMatchObject({ passed: false, errorCount: 2 });
    });
});
