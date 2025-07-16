import Ajv2020, { ErrorObject } from 'ajv/dist/2020.js';
import { SchemaDirectory } from '../../schema-directory.js';

export class JsonSchemaValidator {
    private validateFn: (instance: object) => boolean;
    private ajv: Ajv2020;

    constructor(schemaDirectory: SchemaDirectory, pattern: object, debug: boolean = false) {
        const strictType = debug ? 'log' : false;
        this.ajv = new Ajv2020({
            strict: strictType,
            allErrors: true,
            loadSchema: async (schemaId) => {
                try {
                    return schemaDirectory.getSchema(schemaId);
                } catch (error) {
                    console.error(`Error fetching schema: ${error.message}`);
                }
            }
        });
        // Compile synchronously for now (pattern is assumed to be local object)
        this.validateFn = this.ajv.compile(pattern);
    }

    validate(instance: object): ErrorObject[] {
        const valid = this.validateFn(instance);
        if (valid) {
            return [];
        } else {
            return (this.validateFn as any).errors || [];
        }
    }
}
