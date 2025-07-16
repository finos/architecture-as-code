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
        schemaDirectory = {
            getSchema: vi.fn()
        } as any;
        pattern = { type: 'object' };
        validateFn = vi.fn() as any; // returns true/false for valid, then the function itself will have an errors property
        ajvCompileMock = vi.spyOn(Ajv2020.prototype, 'compile').mockReturnValue(validateFn as any);
    });

    afterEach(() => {
        ajvCompileMock.mockRestore();
    });

    it('constructs Ajv2020 with correct parameters', () => {
        new JsonSchemaValidator(schemaDirectory, pattern, true);
        expect(ajvCompileMock).toHaveBeenCalledWith(pattern);
    });

    it('propagates errors thrown by the constructor', () => {
        ajvCompileMock.mockImplementation(() => { throw new Error('compile error'); });
        expect(() => new JsonSchemaValidator(schemaDirectory, pattern)).toThrowError('compile error');
    });

    it('validate calls ajv validate and returns errors', () => {
        const validator = new JsonSchemaValidator(schemaDirectory, pattern);
        validateFn.mockReturnValue(false);
        (validateFn as any).errors = [{ message: 'error' }];
        const result = validator.validate({});
        expect(validateFn).toHaveBeenCalledWith({});
        expect(result).toEqual([{ message: 'error' }]);
    });

    it('validate returns empty array if valid', () => {
        const validator = new JsonSchemaValidator(schemaDirectory, pattern);
        validateFn.mockReturnValue(true);
        const result = validator.validate({});
        expect(result).toEqual([]);
    });
});
