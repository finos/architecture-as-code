import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveSchemaRef, loadArchitectureAndPattern, loadArchitecture, loadPattern, loadPatternFromArchitectureIfPresent } from './loading-helpers';
import { CALM_HUB_PROTO, DocumentLoader } from './document-loader';
import { SchemaDirectory } from '../schema-directory';
import { Logger } from '../logger';

describe('resolveSchemaRef', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockLogger: any = { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() };

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

describe('loading helpers', () => {
    const mockLogger = { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), log: vi.fn(), info: vi.fn() } as unknown as Logger;
    const mockDocLoader = {
        loadMissingDocument: vi.fn(),
        initialise: vi.fn(),
        resolvePath: vi.fn()
    } as unknown as DocumentLoader;
    const mockSchemaDirectory = {
        getSchema: vi.fn()
    } as unknown as SchemaDirectory;

    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('loadArchitecture', () => {
        it('should return undefined if architecturePath is not provided', async () => {
            const result = await loadArchitecture(undefined, mockDocLoader, mockLogger);
            expect(result).toBeUndefined();
        });

        it('should load architecture from path', async () => {
            const arch = { kind: 'architecture' };
            vi.mocked(mockDocLoader.loadMissingDocument).mockResolvedValue(arch);
            const result = await loadArchitecture('path/to/arch.json', mockDocLoader, mockLogger);
            expect(mockDocLoader.loadMissingDocument).toHaveBeenCalledWith('path/to/arch.json', 'architecture');
            expect(result).toBe(arch);
        });
    });

    describe('loadPattern', () => {
        it('should return undefined if patternPath is not provided', async () => {
            const result = await loadPattern(undefined, mockDocLoader, mockLogger);
            expect(result).toBeUndefined();
        });

        it('should load pattern from path', async () => {
            const pattern = { kind: 'pattern' };
            vi.mocked(mockDocLoader.loadMissingDocument).mockResolvedValue(pattern);
            const result = await loadPattern('path/to/pattern.json', mockDocLoader, mockLogger);
            expect(mockDocLoader.loadMissingDocument).toHaveBeenCalledWith('path/to/pattern.json', 'pattern');
            expect(result).toBe(pattern);
        });
    });

    describe('loadPatternFromArchitectureIfPresent', () => {
        it('should return undefined if architecture is missing', async () => {
            const result = await loadPatternFromArchitectureIfPresent(undefined, 'arch.json', mockDocLoader, mockSchemaDirectory, mockLogger);
            expect(result).toBeUndefined();
        });

        it('should return undefined if architecture has no $schema', async () => {
            const result = await loadPatternFromArchitectureIfPresent({}, 'arch.json', mockDocLoader, mockSchemaDirectory, mockLogger);
            expect(result).toBeUndefined();
        });

        it('should load schema from SchemaDirectory if available', async () => {
            const schema = { kind: 'pattern' };
            const arch = { '$schema': 'pattern.json' };
            vi.mocked(mockSchemaDirectory.getSchema).mockResolvedValue(schema);

            const result = await loadPatternFromArchitectureIfPresent(arch, '/path/arch.json', mockDocLoader, mockSchemaDirectory, mockLogger);
            
            expect(mockSchemaDirectory.getSchema).toHaveBeenCalledWith('/path/pattern.json');
            expect(result).toBe(schema);
        });

        it('should fall back to docLoader if SchemaDirectory throws', async () => {
            const pattern = { kind: 'pattern' };
            const arch = { '$schema': 'pattern.json' };
            vi.mocked(mockSchemaDirectory.getSchema).mockRejectedValue(new Error('not found'));
            vi.mocked(mockDocLoader.loadMissingDocument).mockResolvedValue(pattern);

            const result = await loadPatternFromArchitectureIfPresent(arch, '/path/arch.json', mockDocLoader, mockSchemaDirectory, mockLogger);

            expect(mockDocLoader.loadMissingDocument).toHaveBeenCalledWith('/path/pattern.json', 'pattern');
            expect(result).toBe(pattern);
        });
    });

    describe('loadArchitectureAndPattern', () => {
        it('should load architecture and pattern when both paths provided', async () => {
            const arch = { kind: 'architecture' };
            const pattern = { kind: 'pattern' };
            vi.mocked(mockDocLoader.loadMissingDocument)
                .mockResolvedValueOnce(arch)
                .mockResolvedValueOnce(pattern);

            const result = await loadArchitectureAndPattern('arch.json', 'pattern.json', mockDocLoader, mockSchemaDirectory, mockLogger);
            
            expect(result).toEqual({ architecture: arch, pattern });
        });

        it('should load pattern only if architecture fails to load', async () => {
            const pattern = { kind: 'pattern' };
            vi.mocked(mockDocLoader.loadMissingDocument)
                .mockResolvedValueOnce(undefined) // architecture
                .mockResolvedValueOnce(pattern);  // pattern

            const result = await loadArchitectureAndPattern('arch.json', 'pattern.json', mockDocLoader, mockSchemaDirectory, mockLogger);

            expect(result).toEqual({ architecture: undefined, pattern });
        });

        it('should load pattern from architecture if patternPath missing', async () => {
            const arch = { kind: 'architecture', '$schema': 'pattern.json' };
            const pattern = { kind: 'pattern' };
            vi.mocked(mockDocLoader.loadMissingDocument).mockResolvedValueOnce(arch);
            vi.mocked(mockSchemaDirectory.getSchema).mockResolvedValue(pattern);

            const result = await loadArchitectureAndPattern('arch.json', undefined, mockDocLoader, mockSchemaDirectory, mockLogger);

            expect(result).toEqual({ architecture: arch, pattern });
        });
    });
});
