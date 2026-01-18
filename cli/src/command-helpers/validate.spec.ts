import { Command } from 'commander';
import { Mock } from 'vitest';
import { getFormattedOutput, validate, exitBasedOffOfValidationOutcome } from '@finos/calm-shared';
import { CALM_HUB_PROTO } from '@finos/calm-shared/dist/document-loader/document-loader';
import { mkdirp } from 'mkdirp';
import { writeFileSync } from 'fs';
import path from 'path';
import { runValidate, writeOutputFile, checkValidateOptions, ValidateOptions, resolveSchemaRef, __test__ } from './validate';


const dummyArch = { dummy: 'arch' };
const dummyPattern = { dummy: 'pattern' };
const dummyArchOfAPattern = { '$schema': 'pattern.json', dummy: 'arch' };
const dummyArchOfCalmSchema = { '$schema': 'calm-schema.json', dummy: 'arch' };
const dummyCalmSchema = { '$id': 'calm-schema.json', dummy: 'calm schema' };

const mocks = vi.hoisted(() => ({
    validate: vi.fn(),
    getFormattedOutput: vi.fn(),
    exitBasedOffOfValidationOutcome: vi.fn(),
    initLogger: vi.fn(() => ({ error: vi.fn(), debug: vi.fn() })),
    processExit: vi.fn(),
    mkdirpSync: vi.fn(),
    writeFileSync: vi.fn(),
    parseDocumentLoaderConfig: vi.fn(),
    buildDocumentLoader: vi.fn(() => ({
        loadMissingDocument: mocks.loadMissingDocument
    })),
    loadSchemas: vi.fn(),
    getSchema: vi.fn(),
    loadMissingDocument: vi.fn()
}));

vi.mock('@finos/calm-shared', async () => ({
    ...(await vi.importActual('@finos/calm-shared')),
    validate: mocks.validate,
    getFormattedOutput: mocks.getFormattedOutput,
    exitBasedOffOfValidationOutcome: mocks.exitBasedOffOfValidationOutcome,
    initLogger: mocks.initLogger,
    loadSchemas: mocks.loadSchemas
}));

vi.mock('mkdirp', () => ({
    mkdirp: { sync: mocks.mkdirpSync },
}));

vi.mock('fs', () => ({
    ...vi.importActual('fs'),
    writeFileSync: mocks.writeFileSync,
}));

vi.mock('../cli', async () => ({
    ...(await vi.importActual('../cli')),
    parseDocumentLoaderConfig: mocks.parseDocumentLoaderConfig,
    buildSchemaDirectory: vi.fn(() => ({
        loadSchemas: mocks.loadSchemas,
        getSchema: mocks.getSchema
    })),
}));

vi.mock('@finos/calm-shared/dist/document-loader/document-loader', async () => ({
    ...(await vi.importActual('@finos/calm-shared/dist/document-loader/document-loader')),
    buildDocumentLoader: mocks.buildDocumentLoader
}));

describe('runValidate', () => {
    const fakeOutcome = { valid: true };

    beforeEach(() => {
        vi.resetAllMocks();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        process.exit = mocks.processExit as any;

        mocks.parseDocumentLoaderConfig.mockResolvedValue({});
        // Inline mock for loadMissingDocument
        mocks.loadMissingDocument.mockImplementation((filePath: string, _: string) => {
            if (filePath === 'arch.json') return Promise.resolve(dummyArch);
            if (filePath === 'arch-of-pattern.json') return Promise.resolve(dummyArchOfAPattern);
            if (filePath === 'arch-of-calm.json') return Promise.resolve(dummyArchOfCalmSchema);
            if (filePath === 'pattern.json') return Promise.resolve(dummyPattern);
            // Handle resolved absolute paths for $schema references
            if (filePath.endsWith('pattern.json')) return Promise.resolve(dummyPattern);
            return Promise.resolve();
        });
        mocks.getSchema.mockImplementation((schemaId: string) => {
            // Handle both relative and resolved absolute paths
            if (schemaId === 'calm-schema.json' || schemaId.endsWith('calm-schema.json')) return dummyCalmSchema;
            throw new Error(`Schema ${schemaId} not found`);
        });
        (validate as Mock).mockResolvedValue(fakeOutcome);
        (getFormattedOutput as Mock).mockReturnValue('formatted output');
    });

    it('should process validation successfully with both architecture and pattern', async () => {
        const options: ValidateOptions = {
            architecturePath: 'arch.json',
            patternPath: 'pattern.json',
            metaSchemaPath: 'schemas',
            verbose: true,
            outputFormat: 'json',
            outputPath: 'out.json',
            strict: false,
        };


        await runValidate(options);

        expect(mocks.loadSchemas).toHaveBeenCalled();
        expect(mocks.loadMissingDocument).toHaveBeenCalledWith('arch.json', 'architecture');
        expect(mocks.loadMissingDocument).toHaveBeenCalledWith('pattern.json', 'pattern');
        expect(validate).toHaveBeenCalledWith(dummyArch, dummyPattern, expect.anything(), true);
        expect(getFormattedOutput).toHaveBeenCalledWith(fakeOutcome, 'json', expect.anything());
        expect(exitBasedOffOfValidationOutcome).toHaveBeenCalledWith(fakeOutcome, false);

        expect(mkdirp.sync).toHaveBeenCalledWith(path.dirname('out.json'));
        expect(writeFileSync).toHaveBeenCalledWith('out.json', 'formatted output');
    });

    it('should process validation successfully with architecture only', async () => {
        const options: ValidateOptions = {
            architecturePath: 'arch.json',
            patternPath: undefined,
            metaSchemaPath: 'schemas',
            verbose: true,
            outputFormat: 'json',
            outputPath: 'out.json',
            strict: false,
        };


        await runValidate(options);

        expect(mocks.loadSchemas).toHaveBeenCalled();
        expect(mocks.loadMissingDocument).toHaveBeenCalledWith('arch.json', 'architecture');
        expect(validate).toHaveBeenCalledWith(dummyArch, undefined, expect.anything(), true);
        expect(getFormattedOutput).toHaveBeenCalledWith(fakeOutcome, 'json', expect.anything());
        expect(exitBasedOffOfValidationOutcome).toHaveBeenCalledWith(fakeOutcome, false);

        expect(mkdirp.sync).toHaveBeenCalledWith(path.dirname('out.json'));
        expect(writeFileSync).toHaveBeenCalledWith('out.json', 'formatted output');
    });

    it('should process validation successfully with architecture only and architecture has a pattern', async () => {
        const options: ValidateOptions = {
            architecturePath: 'arch-of-pattern.json',
            patternPath: undefined,
            metaSchemaPath: 'schemas',
            verbose: true,
            outputFormat: 'json',
            outputPath: 'out.json',
            strict: false,
        };


        await runValidate(options);

        expect(mocks.loadSchemas).toHaveBeenCalled();
        // $schema reference is resolved to absolute path relative to architecture file
        const resolvedPatternPath = path.resolve(process.cwd(), 'pattern.json');
        expect(mocks.getSchema).toHaveBeenCalledWith(resolvedPatternPath);
        expect(mocks.loadMissingDocument).toHaveBeenCalledWith('arch-of-pattern.json', 'architecture');
        expect(mocks.loadMissingDocument).toHaveBeenCalledWith(resolvedPatternPath, 'pattern');
        expect(validate).toHaveBeenCalledWith(dummyArchOfAPattern, dummyPattern, expect.anything(), true);
        expect(getFormattedOutput).toHaveBeenCalledWith(fakeOutcome, 'json', expect.anything());
        expect(exitBasedOffOfValidationOutcome).toHaveBeenCalledWith(fakeOutcome, false);

        expect(mkdirp.sync).toHaveBeenCalledWith(path.dirname('out.json'));
        expect(writeFileSync).toHaveBeenCalledWith('out.json', 'formatted output');
    });

    it('should process validation successfully with architecture only and architecture references CALM schema', async () => {
        const options: ValidateOptions = {
            architecturePath: 'arch-of-calm.json',
            patternPath: undefined,
            metaSchemaPath: 'schemas',
            verbose: true,
            outputFormat: 'json',
            outputPath: 'out.json',
            strict: false,
        };


        await runValidate(options);

        expect(mocks.loadSchemas).toHaveBeenCalled();
        // $schema reference is resolved to absolute path relative to architecture file
        const resolvedSchemaPath = path.resolve(process.cwd(), 'calm-schema.json');
        expect(mocks.getSchema).toHaveBeenCalledWith(resolvedSchemaPath);
        expect(mocks.loadMissingDocument).toHaveBeenCalledWith('arch-of-calm.json', 'architecture');
        expect(mocks.loadMissingDocument).toHaveBeenCalledOnce();
        expect(validate).toHaveBeenCalledWith(dummyArchOfCalmSchema, dummyCalmSchema, expect.anything(), true);
        expect(getFormattedOutput).toHaveBeenCalledWith(fakeOutcome, 'json', expect.anything());
        expect(exitBasedOffOfValidationOutcome).toHaveBeenCalledWith(fakeOutcome, false);

        expect(mkdirp.sync).toHaveBeenCalledWith(path.dirname('out.json'));
        expect(writeFileSync).toHaveBeenCalledWith('out.json', 'formatted output');
    });

    it('should process validation successfully with pattern only', async () => {
        const options: ValidateOptions = {
            architecturePath: undefined,
            patternPath: 'pattern.json',
            metaSchemaPath: 'schemas',
            verbose: true,
            outputFormat: 'json',
            outputPath: 'out.json',
            strict: false,
        };


        await runValidate(options);

        expect(mocks.loadSchemas).toHaveBeenCalled();
        expect(mocks.loadMissingDocument).toHaveBeenCalledWith('pattern.json', 'pattern');
        expect(validate).toHaveBeenCalledWith(undefined, dummyPattern, expect.anything(), true);
        expect(getFormattedOutput).toHaveBeenCalledWith(fakeOutcome, 'json', expect.anything());
        expect(exitBasedOffOfValidationOutcome).toHaveBeenCalledWith(fakeOutcome, false);

        expect(mkdirp.sync).toHaveBeenCalledWith(path.dirname('out.json'));
        expect(writeFileSync).toHaveBeenCalledWith('out.json', 'formatted output');
    });

    it('should call process.exit(1) when an error occurs', async () => {
        const options: ValidateOptions = {
            architecturePath: 'arch.json',
            patternPath: 'pattern.json',
            metaSchemaPath: 'schemas',
            verbose: true,
            outputFormat: 'json',
            outputPath: 'out.json',
            strict: false,
        };

        mocks.parseDocumentLoaderConfig.mockResolvedValue({});
        mocks.buildDocumentLoader.mockReturnValue({
            loadMissingDocument: vi.fn((filePath: string) => {
                if (filePath === 'arch.json') return dummyArch;
                if (filePath === 'pattern.json') return dummyPattern;
                return undefined;
            })
        });

        const error = new Error('Validation failed');
        (validate as Mock).mockRejectedValue(error);

        await runValidate(options);
        expect(mocks.processExit).toHaveBeenCalledWith(1);
    });
});

describe('writeOutputFile', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('should write output to file if output is provided', () => {
        const output = 'dir/out.txt';
        const content = 'some content';
        writeOutputFile(output, content);
        expect(mkdirp.sync).toHaveBeenCalledWith(path.dirname(output));
        expect(writeFileSync).toHaveBeenCalledWith(output, content);
    });

    it('should write output to stdout if no output is provided', () => {
        const content = 'stdout content';
        const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        writeOutputFile('', content);
        expect(stdoutSpy).toHaveBeenCalledWith(content);
        stdoutSpy.mockRestore();
    });
});


describe('checkValidateOptions', () => {
    it('should call program.error if neither pattern nor architecture is provided', () => {
        const program = new Command();
        const errorSpy = vi.spyOn(program, 'error').mockImplementation((msg: string) => { throw new Error(msg); });
        const options = {};
        expect(() => checkValidateOptions(program, options, '-p, --pattern <file>', '-a, --architecture <file>')).toThrow(/one of the required options/);
        errorSpy.mockRestore();
    });

    it('should not call program.error if a pattern is provided', () => {
        const program = new Command();
        const errorSpy = vi.spyOn(program, 'error').mockImplementation((msg: string) => { throw new Error(msg); });
        const options = { pattern: 'pattern.json' };
        expect(() => checkValidateOptions(program, options, '-p, --pattern <file>', '-a, --architecture <file>')).not.toThrow();
        errorSpy.mockRestore();
    });

    it('should not call program.error if an architecture is provided', () => {
        const program = new Command();
        const errorSpy = vi.spyOn(program, 'error').mockImplementation((msg: string) => { throw new Error(msg); });
        const options = { architecture: 'arch.json' };
        expect(() => checkValidateOptions(program, options, '-p, --pattern <file>', '-a, --architecture <file>')).not.toThrow();
        errorSpy.mockRestore();
    });
});

describe('resolveSchemaRef', () => {
    const mockLogger = { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() };

    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('should return http URLs unchanged', () => {
        const result = resolveSchemaRef('http://example.com/schema.json', '/path/to/arch.json', mockLogger);
        expect(result).toBe('http://example.com/schema.json');
    });

    it('should return https URLs unchanged', () => {
        const result = resolveSchemaRef('https://calm.finos.org/schema.json', '/path/to/arch.json', mockLogger);
        expect(result).toBe('https://calm.finos.org/schema.json');
    });

    it(`should return ${CALM_HUB_PROTO} protocol URLs unchanged`, () => {
        const result = resolveSchemaRef(`${CALM_HUB_PROTO}//namespace/schema`, '/path/to/arch.json', mockLogger);
        expect(result).toBe(`${CALM_HUB_PROTO}//namespace/schema`);
    });

    it('should return file:// URLs unchanged', () => {
        const result = resolveSchemaRef('file:///absolute/path/schema.json', '/path/to/arch.json', mockLogger);
        expect(result).toBe('file:///absolute/path/schema.json');
    });

    it('should return absolute file paths unchanged', () => {
        const result = resolveSchemaRef('/absolute/path/schema.json', '/path/to/arch.json', mockLogger);
        expect(result).toBe('/absolute/path/schema.json');
    });

    it('should resolve relative paths against architecture file directory', () => {
        const result = resolveSchemaRef('../schemas/custom.json', '/project/architectures/arch.json', mockLogger);
        expect(result).toBe('/project/schemas/custom.json');
    });

    it('should resolve sibling relative paths against architecture file directory', () => {
        const result = resolveSchemaRef('./schema.json', '/project/architectures/arch.json', mockLogger);
        expect(result).toBe('/project/architectures/schema.json');
    });

    it('should resolve simple filename against architecture file directory', () => {
        const result = resolveSchemaRef('schema.json', '/project/architectures/arch.json', mockLogger);
        expect(result).toBe('/project/architectures/schema.json');
    });

    it('should return schemaRef unchanged when architecturePath is empty', () => {
        const result = resolveSchemaRef('../schemas/custom.json', '', mockLogger);
        expect(result).toBe('../schemas/custom.json');
    });

    it('should log debug message when resolving relative path', () => {
        resolveSchemaRef('../schemas/custom.json', '/project/architectures/arch.json', mockLogger);
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('Resolved relative $schema path')
        );
    });
});

describe('rewritePathWithIds', () => {
    const { rewritePathWithIds } = __test__;

    const document = {
        nodes: [
            {
                'unique-id': 'api-producer',
                interfaces: [
                    {
                        'unique-id': 'producer-ingress',
                        port: 8080
                    },
                    {
                        'unique-id': 'http-config',
                        config: {
                            targets: [
                                { 'unique-id': 'target-a', url: 'a' },
                                { url: 'b' }
                            ]
                        }
                    }
                ]
            },
            {
                interfaces: [
                    {
                        port: 9090
                    }
                ]
            }
        ],
        meta: { id: 'root' }
    } as const;

    it('rewrites simple object paths unchanged', () => {
        expect(rewritePathWithIds('/meta/id', document)).toBe('/meta/id');
    });

    it('uses array unique-ids when present', () => {
        expect(rewritePathWithIds('/nodes/0/interfaces/0/port', document))
            .toBe('/nodes/api-producer/interfaces/producer-ingress/port');
    });

    it('falls back to array index when no unique-id is present', () => {
        expect(rewritePathWithIds('/nodes/1/interfaces/0/port', document))
            .toBe('/nodes/1/interfaces/0/port');
    });

    it('handles nested array segments combining ids and indexes', () => {
        expect(rewritePathWithIds('/nodes/0/interfaces/1/config/targets/1/url', document))
            .toBe('/nodes/api-producer/interfaces/http-config/config/targets/1/url');
    });

    it('returns undefined when pointer path is empty or data missing', () => {
        expect(rewritePathWithIds('', document)).toBeUndefined();
        expect(rewritePathWithIds('/anything', undefined)).toBeUndefined();
    });
});
