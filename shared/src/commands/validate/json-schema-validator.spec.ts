import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { JsonSchemaValidator } from './json-schema-validator';
import Ajv2020 from 'ajv/dist/2020.js';
import { SchemaDirectory } from '../../schema-directory.js';
import { FileSystemDocumentLoader } from '../../document-loader/file-system-document-loader.js';
import path from 'path';
import { readFileSync } from 'fs';

describe('JsonSchemaValidator', () => {
    let schemaDirectory: SchemaDirectory;
    let pattern: object;
    let ajvCompileMock: ReturnType<typeof vi.spyOn>;
    let validateFn: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        schemaDirectory = { getSchema: vi.fn() } as any;
        pattern = { type: 'object' };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        validateFn = vi.fn() as any; // returns true/false for valid, then the function itself will have an errors property
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ajvCompileMock = vi.spyOn(Ajv2020.prototype, 'compileAsync').mockReturnValue(validateFn as any);
    });

    afterEach(() => {
        ajvCompileMock.mockRestore();
    });

    it('constructs Ajv2020 with correct parameters', async () => {
        const validator = new JsonSchemaValidator(schemaDirectory, pattern, true);
        await validator.initialize();
        expect(ajvCompileMock).toHaveBeenCalledWith(pattern);
    });

    it('initialise propagates errors thrown by ajv', async () => {
        ajvCompileMock.mockImplementation(() => { throw new Error('compile error'); });
        expect(async () => {
            const validator = new JsonSchemaValidator(schemaDirectory, pattern);
            await validator.initialize();
        }).rejects.toThrowError('compile error');
    });

    it('validate calls ajv validate and returns errors', async () => {
        const validator = new JsonSchemaValidator(schemaDirectory, pattern);
        await validator.initialize();
        validateFn.mockReturnValue(false);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (validateFn as any).errors = [{ message: 'error' }];
        const result = validator.validate({});
        expect(validateFn).toHaveBeenCalledWith({});
        expect(result).toEqual([{ message: 'error' }]);
    });

    it('validate returns empty array if valid', async () => {
        const validator = new JsonSchemaValidator(schemaDirectory, pattern);
        await validator.initialize();
        validateFn.mockReturnValue(true);
        const result = validator.validate({});
        expect(result).toEqual([]);
    });

    it('validate throws if not initialized', () => {
        const validator = new JsonSchemaValidator(schemaDirectory, pattern);
        expect(() => validator.validate({})).toThrowError('Validator has not been initialized. Call initialize() before validating.');
    });
});

describe('JsonSchemaValidator integration', () => {
    const schemaDir = path.join(__dirname, '../../../../calm/release/1.1/meta/');
    const badPatternPath = path.join(__dirname, '../../../test_fixtures/bad-schema/bad-json-schema.json');

    it('throws when compiling the bad-json-schema fixture', async () => {
        const schemaDirectory = new SchemaDirectory(new FileSystemDocumentLoader([schemaDir], true));
        await schemaDirectory.loadSchemas();
        const badPattern = JSON.parse(readFileSync(badPatternPath, 'utf-8'));
        const validator = new JsonSchemaValidator(schemaDirectory, badPattern);

        await expect(validator.initialize()).rejects.toThrow(/type/i);
    });
});
