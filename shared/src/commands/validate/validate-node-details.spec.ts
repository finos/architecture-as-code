import { validateNodeDetails, ArchitectureValidator } from './validate-node-details';
import { SchemaDirectory } from '../../schema-directory';
import { ValidationOutput, ValidationOutcome } from './validation.output';
import { CachingTrackingResolver } from '../../resolver/caching-tracking-resolver';

function makeResolver(dir: SchemaDirectory): CachingTrackingResolver {
    return new CachingTrackingResolver({
        canResolve: () => true,
        resolve: (url: string) => dir.loadDocument(url, 'architecture')
    });
}

vi.mock('../../logger.js', () => ({
    initLogger: () => ({
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    })
}));

const subArchitecture = {
    '$schema': 'https://example.com/pattern.json',
    nodes: [{ 'unique-id': 'sub-node', 'node-type': 'service', name: 'Sub Node', description: 'Sub' }],
    relationships: []
};

const patternDoc = { $id: 'https://example.com/pattern.json', type: 'object' };

function makeSchemaDirectory(overrides: Partial<{
    loadDocument: ReturnType<typeof vi.fn>,
    getSchema: ReturnType<typeof vi.fn>,
    fork: ReturnType<typeof vi.fn>,
    loadSchemas: ReturnType<typeof vi.fn>,
}> = {}): SchemaDirectory {
    const freshDir = {
        getSchema: vi.fn().mockResolvedValue(undefined),
        loadDocument: vi.fn(),
        fork: vi.fn(),
        loadSchemas: vi.fn().mockResolvedValue(undefined),
        storeDocument: vi.fn(),
        getLoadedSchemas: vi.fn().mockReturnValue([]),
    };
    return {
        getSchema: vi.fn().mockResolvedValue(patternDoc),
        loadDocument: overrides.loadDocument ?? vi.fn().mockResolvedValue(subArchitecture),
        fork: overrides.fork ?? vi.fn().mockReturnValue(freshDir),
        loadSchemas: vi.fn().mockResolvedValue(undefined),
        storeDocument: vi.fn(),
        getLoadedSchemas: vi.fn().mockReturnValue([]),
    } as unknown as SchemaDirectory;
}

function emptyOutcome(): ValidationOutcome {
    return new ValidationOutcome([], [], false, false);
}

function errorOutcome(path: string): ValidationOutcome {
    return new ValidationOutcome(
        [new ValidationOutput('json-schema', 'error', 'sub-arch error', path, undefined)],
        [],
        true,
        false
    );
}

const noop: ArchitectureValidator = vi.fn().mockResolvedValue(emptyOutcome());

describe('validateNodeDetails', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (noop as ReturnType<typeof vi.fn>).mockResolvedValue(emptyOutcome());
    });

    it('returns empty outputs when architecture has no node details', async () => {
        const arch = { nodes: [{ 'unique-id': 'n1', 'node-type': 'service', name: 'N', description: 'D' }] };
        const dir = makeSchemaDirectory();
        const result = await validateNodeDetails(arch, dir, false, noop, makeResolver(dir));
        expect(result.jsonSchemaOutputs).toHaveLength(0);
        expect(result.hasErrors).toBe(false);
        expect(noop).not.toHaveBeenCalled();
    });

    it('loads sub-architecture and calls recursiveValidator when node has detailed-architecture', async () => {
        const arch = {
            nodes: [{
                'unique-id': 'n1',
                'node-type': 'service',
                name: 'N',
                description: 'D',
                details: { 'detailed-architecture': 'https://example.com/sub-arch.json' }
            }]
        };
        const schemaDir = makeSchemaDirectory();
        const result = await validateNodeDetails(arch, schemaDir, false, noop, makeResolver(schemaDir));
        expect(schemaDir.loadDocument).toHaveBeenCalledWith('https://example.com/sub-arch.json', 'architecture');
        expect(noop).toHaveBeenCalledOnce();
        expect(result.hasErrors).toBe(false);
    });

    it('discovers pattern from $schema of sub-architecture when required-pattern is not set', async () => {
        const arch = {
            nodes: [{
                'unique-id': 'n1',
                'node-type': 'service',
                name: 'N',
                description: 'D',
                details: { 'detailed-architecture': 'https://example.com/sub-arch.json' }
            }]
        };
        const schemaDir = makeSchemaDirectory();
        await validateNodeDetails(arch, schemaDir, false, noop, makeResolver(schemaDir));
        // schemaDir.getSchema should have been called with the $schema URL from subArchitecture
        expect(schemaDir.getSchema).toHaveBeenCalledWith('https://example.com/pattern.json');
        expect(noop).toHaveBeenCalledWith(
            subArchitecture,
            patternDoc,
            expect.anything(),  // fresh schema dir
            false,
            expect.any(CachingTrackingResolver)
        );
    });

    it('uses required-pattern when it is set on the node details', async () => {
        const explicitPatternUrl = 'https://example.com/explicit-pattern.json';
        const explicitPattern = { $id: explicitPatternUrl, type: 'object' };
        const arch = {
            nodes: [{
                'unique-id': 'n1',
                'node-type': 'service',
                name: 'N',
                description: 'D',
                details: {
                    'detailed-architecture': 'https://example.com/sub-arch.json',
                    'required-pattern': explicitPatternUrl
                }
            }]
        };
        const schemaDir = makeSchemaDirectory();
        (schemaDir.getSchema as ReturnType<typeof vi.fn>).mockResolvedValue(explicitPattern);
        await validateNodeDetails(arch, schemaDir, false, noop, makeResolver(schemaDir));
        expect(noop).toHaveBeenCalledWith(
            subArchitecture,
            explicitPattern,
            expect.anything(),
            false,
            expect.any(CachingTrackingResolver)
        );
    });

    it('emits error at correct path when sub-architecture cannot be loaded', async () => {
        const arch = {
            nodes: [{
                'unique-id': 'n1',
                'node-type': 'service',
                name: 'N',
                description: 'D',
                details: { 'detailed-architecture': 'https://example.com/missing-sub-arch.json' }
            }]
        };
        const schemaDir = makeSchemaDirectory({
            loadDocument: vi.fn().mockRejectedValue(new Error('not found'))
        });
        const result = await validateNodeDetails(arch, schemaDir, false, noop, makeResolver(schemaDir));
        expect(result.hasErrors).toBe(true);
        expect(result.jsonSchemaOutputs).toHaveLength(1);
        expect(result.jsonSchemaOutputs[0].path).toBe('/nodes/0/details/detailed-architecture');
        expect(result.jsonSchemaOutputs[0].message).toContain('not found');
        expect(noop).not.toHaveBeenCalled();
    });

    it('prefixes sub-architecture errors with node path', async () => {
        const arch = {
            nodes: [{
                'unique-id': 'n1',
                'node-type': 'service',
                name: 'N',
                description: 'D',
                details: { 'detailed-architecture': 'https://example.com/sub-arch.json' }
            }]
        };
        const schemaDir = makeSchemaDirectory();
        (noop as ReturnType<typeof vi.fn>).mockResolvedValue(errorOutcome('/nodes/0'));
        const result = await validateNodeDetails(arch, schemaDir, false, noop, makeResolver(schemaDir));
        expect(result.hasErrors).toBe(true);
        expect(result.jsonSchemaOutputs).toHaveLength(1);
        expect(result.jsonSchemaOutputs[0].path).toBe('/nodes/0/details/detailed-architecture/nodes/0');
    });

    it('prefixes root path "/" from sub-architecture as just the node path prefix', async () => {
        const arch = {
            nodes: [{
                'unique-id': 'n1',
                'node-type': 'service',
                name: 'N',
                description: 'D',
                details: { 'detailed-architecture': 'https://example.com/sub-arch.json' }
            }]
        };
        const schemaDir = makeSchemaDirectory();
        (noop as ReturnType<typeof vi.fn>).mockResolvedValue(errorOutcome('/'));
        const result = await validateNodeDetails(arch, schemaDir, false, noop, makeResolver(schemaDir));
        expect(result.jsonSchemaOutputs[0].path).toBe('/nodes/0/details/detailed-architecture');
    });

    it('skips already-visited architecture URL (cycle detection)', async () => {
        const archUrl = 'https://example.com/sub-arch.json';
        const arch = {
            nodes: [{
                'unique-id': 'n1',
                'node-type': 'service',
                name: 'N',
                description: 'D',
                details: { 'detailed-architecture': archUrl }
            }]
        };
        const schemaDir = makeSchemaDirectory();
        const references = makeResolver(schemaDir);
        references.markSeen(archUrl);
        const result = await validateNodeDetails(arch, schemaDir, false, noop, references);
        expect(noop).not.toHaveBeenCalled();
        expect(result.hasErrors).toBe(false);
        expect(schemaDir.loadDocument).not.toHaveBeenCalled();
    });

    it('validates both nodes when two nodes have detailed-architecture', async () => {
        const arch = {
            nodes: [
                {
                    'unique-id': 'n1',
                    'node-type': 'service',
                    name: 'N1',
                    description: 'D',
                    details: { 'detailed-architecture': 'https://example.com/sub-arch-1.json' }
                },
                {
                    'unique-id': 'n2',
                    'node-type': 'service',
                    name: 'N2',
                    description: 'D',
                    details: { 'detailed-architecture': 'https://example.com/sub-arch-2.json' }
                }
            ]
        };
        const schemaDir = makeSchemaDirectory();
        (noop as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce(errorOutcome('/x'))
            .mockResolvedValueOnce(errorOutcome('/y'));

        const result = await validateNodeDetails(arch, schemaDir, false, noop, makeResolver(schemaDir));
        expect(noop).toHaveBeenCalledTimes(2);
        expect(result.jsonSchemaOutputs).toHaveLength(2);
        expect(result.jsonSchemaOutputs[0].path).toBe('/nodes/0/details/detailed-architecture/x');
        expect(result.jsonSchemaOutputs[1].path).toBe('/nodes/1/details/detailed-architecture/y');
    });

    it('propagates hasWarnings from sub-architecture outcome', async () => {
        const arch = {
            nodes: [{
                'unique-id': 'n1',
                'node-type': 'service',
                name: 'N',
                description: 'D',
                details: { 'detailed-architecture': 'https://example.com/sub-arch.json' }
            }]
        };
        const schemaDir = makeSchemaDirectory();
        const warningOutcome = new ValidationOutcome([], [], false, true);
        (noop as ReturnType<typeof vi.fn>).mockResolvedValue(warningOutcome);
        const result = await validateNodeDetails(arch, schemaDir, false, noop, makeResolver(schemaDir));
        expect(result.hasWarnings).toBe(true);
        expect(result.hasErrors).toBe(false);
    });

    it('returns empty outputs when architecture cannot be parsed as CalmCore', async () => {
        const result = await validateNodeDetails(null as unknown as object, makeSchemaDirectory(), false, noop, new CachingTrackingResolver({ canResolve: () => false, resolve: () => Promise.reject(new Error('unused')) }));
        expect(result.jsonSchemaOutputs).toHaveLength(0);
        expect(result.hasErrors).toBe(false);
        expect(noop).not.toHaveBeenCalled();
    });

    it('emits error at node path when recursiveValidator throws', async () => {
        const arch = {
            nodes: [{
                'unique-id': 'n1', 'node-type': 'service', name: 'N', description: 'D',
                details: { 'detailed-architecture': 'https://example.com/sub-arch.json' }
            }]
        };
        const schemaDir = makeSchemaDirectory();
        (noop as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('validator exploded'));
        const result = await validateNodeDetails(arch, schemaDir, false, noop, makeResolver(schemaDir));
        expect(result.hasErrors).toBe(true);
        expect(result.jsonSchemaOutputs).toHaveLength(1);
        expect(result.jsonSchemaOutputs[0].path).toBe('/nodes/0/details/detailed-architecture');
        expect(result.jsonSchemaOutputs[0].message).toContain('validator exploded');
    });

    it('validates with undefined pattern when sub-architecture has no $schema and no required-pattern', async () => {
        const subArchNoSchema = {
            nodes: [{ 'unique-id': 'sub-node', 'node-type': 'service', name: 'Sub', description: 'Sub' }],
            relationships: []
        };
        const arch = {
            nodes: [{
                'unique-id': 'n1', 'node-type': 'service', name: 'N', description: 'D',
                details: { 'detailed-architecture': 'https://example.com/sub-arch.json' }
            }]
        };
        const schemaDir = makeSchemaDirectory({ loadDocument: vi.fn().mockResolvedValue(subArchNoSchema) });
        await validateNodeDetails(arch, schemaDir, false, noop, makeResolver(schemaDir));
        expect(schemaDir.getSchema).not.toHaveBeenCalled();
        expect(noop).toHaveBeenCalledWith(subArchNoSchema, undefined, expect.anything(), false, expect.any(CachingTrackingResolver));
    });

    it('falls back to $schema when required-pattern cannot be resolved', async () => {
        const arch = {
            nodes: [{
                'unique-id': 'n1', 'node-type': 'service', name: 'N', description: 'D',
                details: {
                    'detailed-architecture': 'https://example.com/sub-arch.json',
                    'required-pattern': 'https://example.com/explicit-pattern.json'
                }
            }]
        };
        const schemaDir = makeSchemaDirectory();
        (schemaDir.getSchema as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce(undefined)  // required-pattern -> not found
            .mockResolvedValue(patternDoc);    // $schema fallback
        await validateNodeDetails(arch, schemaDir, false, noop, makeResolver(schemaDir));
        expect(noop).toHaveBeenCalledWith(subArchitecture, patternDoc, expect.anything(), false, expect.any(CachingTrackingResolver));
    });

    it('validates with undefined pattern when $schema lookup throws', async () => {
        const arch = {
            nodes: [{
                'unique-id': 'n1', 'node-type': 'service', name: 'N', description: 'D',
                details: { 'detailed-architecture': 'https://example.com/sub-arch.json' }
            }]
        };
        const schemaDir = makeSchemaDirectory();
        (schemaDir.getSchema as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('schema lookup failed'));
        await validateNodeDetails(arch, schemaDir, false, noop, makeResolver(schemaDir));
        expect(noop).toHaveBeenCalledWith(subArchitecture, undefined, expect.anything(), false, expect.any(CachingTrackingResolver));
    });

    it('coerces a non-Error string thrown while loading the sub-architecture', async () => {
        const arch = {
            nodes: [{
                'unique-id': 'n1', 'node-type': 'service', name: 'N', description: 'D',
                details: { 'detailed-architecture': 'https://example.com/sub-arch.json' }
            }]
        };
        const schemaDir = makeSchemaDirectory({ loadDocument: vi.fn().mockRejectedValue('string load failure') });
        const result = await validateNodeDetails(arch, schemaDir, false, noop, makeResolver(schemaDir));
        expect(result.hasErrors).toBe(true);
        expect(result.jsonSchemaOutputs[0].message).toContain('string load failure');
    });

    // Note: this codebase uses the shared getErrorMessage util (String(error)) rather than
    // JSON.stringify, so a non-Error object throw is coerced to '[object Object]'. The behaviour
    // under test is that a non-Error throw is handled gracefully (an error output, no crash).
    it('coerces a non-Error object thrown while loading the sub-architecture', async () => {
        const arch = {
            nodes: [{
                'unique-id': 'n1', 'node-type': 'service', name: 'N', description: 'D',
                details: { 'detailed-architecture': 'https://example.com/sub-arch.json' }
            }]
        };
        const schemaDir = makeSchemaDirectory({ loadDocument: vi.fn().mockRejectedValue({ status: 404 }) });
        const result = await validateNodeDetails(arch, schemaDir, false, noop, makeResolver(schemaDir));
        expect(result.hasErrors).toBe(true);
        expect(result.jsonSchemaOutputs[0].message).toContain('[object Object]');
    });

    it('does not throw when a non-stringifiable (circular) value is thrown while loading the sub-architecture', async () => {
        const circular: Record<string, unknown> = {};
        circular.self = circular;
        const arch = {
            nodes: [{
                'unique-id': 'n1', 'node-type': 'service', name: 'N', description: 'D',
                details: { 'detailed-architecture': 'https://example.com/sub-arch.json' }
            }]
        };
        const schemaDir = makeSchemaDirectory({ loadDocument: vi.fn().mockRejectedValue(circular) });
        const result = await validateNodeDetails(arch, schemaDir, false, noop, makeResolver(schemaDir));
        expect(result.hasErrors).toBe(true);
        expect(result.jsonSchemaOutputs[0].message).toContain('[object Object]');
    });

    it('uses a fresh schema directory (fork) for each sub-architecture', async () => {
        const arch = {
            nodes: [{
                'unique-id': 'n1',
                'node-type': 'service',
                name: 'N',
                description: 'D',
                details: { 'detailed-architecture': 'https://example.com/sub-arch.json' }
            }]
        };
        const freshDir = {
            getSchema: vi.fn().mockResolvedValue(undefined),
            loadDocument: vi.fn(),
            fork: vi.fn(),
            loadSchemas: vi.fn().mockResolvedValue(undefined),
            storeDocument: vi.fn(),
        };
        const schemaDir = makeSchemaDirectory({ fork: vi.fn().mockReturnValue(freshDir) });
        await validateNodeDetails(arch, schemaDir, false, noop, makeResolver(schemaDir));
        expect(schemaDir.fork).toHaveBeenCalledOnce();
        // The cache-seeding fork() means the fresh dir is used directly (no re-load of schemas);
        // the recursiveValidator must receive that forked dir.
        expect(noop).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            freshDir,
            false,
            expect.any(CachingTrackingResolver)
        );
    });
});
