import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { JsonSchemaValidator } from './json-schema-validator';
import Ajv2020 from 'ajv/dist/2020.js';
import { SchemaDirectory } from '../../schema-directory.js';

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
