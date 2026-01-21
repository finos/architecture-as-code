import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveSchemaRef } from './loading-helpers';
import { CALM_HUB_PROTO } from './document-loader';

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
