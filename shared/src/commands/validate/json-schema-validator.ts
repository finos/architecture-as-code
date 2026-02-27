import Ajv2020, { ErrorObject, ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { SchemaDirectory } from '../../schema-directory.js';
import { initLogger, Logger } from '../../logger.js';

export class JsonSchemaValidator {
    private validateFn: ValidateFunction<object>;
    private ajv: Ajv2020;
    private logger: Logger;
    private pattern: object;

    constructor(schemaDirectory: SchemaDirectory, pattern: object, debug: boolean = false) {
        this.logger = initLogger(debug, 'json-schema-validator');
        this.pattern = pattern;
        this.logger.debug('Initialising JSON Schema Validator.');

        const strictType = debug ? 'log' : false;
        this.ajv = new Ajv2020({
            strict: strictType,
            allErrors: true,
            loadSchema: async (schemaId) => {
                this.logger.debug(`AJV is loading missing schema with ID: ${schemaId} from schema directory.`);
                try {
                    return await schemaDirectory.getSchema(schemaId);
                } catch (error) {
                    this.logger.error(`Error fetching schema from schema directory: ${error}`);
                }
            }
        });
        addFormats(this.ajv);
    }

    async initialize(): Promise<void> {
        this.validateFn = await this.ajv.compileAsync(this.pattern);
    }


    validate(instance: object): ErrorObject[] {
        if (!this.validateFn) {
            throw new Error('Validator has not been initialized. Call initialize() before validating.');
        }
        this.logger.debug('Validating instance against JSON Schema.');
        const valid = this.validateFn(instance);
        if (valid) {
            return [];
        } else {
            return this.validateFn.errors || [];
        }
    }
}
