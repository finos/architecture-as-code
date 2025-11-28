import { describe, it, expect } from 'vitest';
import { validate, applyArchitectureOptionsToPattern } from './validate.js';
import { readFileSync } from 'fs';
import path from 'path';
import { FileSystemDocumentLoader } from '../../document-loader/file-system-document-loader.js';
import { SchemaDirectory } from '../../schema-directory.js';

const inputArchPath = path.join(
    __dirname,
    '../../../test_fixtures/command/validate/options/arch.json'
);
const inputPatternPath = path.join(
    __dirname,
    '../../../test_fixtures/command/validate/options/pattern.json'
);
const badPatternPath = path.join(
    __dirname,
    '../../../test_fixtures/bad-schema/bad-json-schema.json'
);
const validationPath = path.join(
    __dirname,
    '../../../test_fixtures/command/validate/'
);

const schemaDir_10 = path.join(__dirname, '../../../../calm/release/1.0/meta/');
const schemaDir_11 = path.join(__dirname, '../../../../calm/release/1.1/meta/');

describe('validate E2E', () => {
    let documentLoader: FileSystemDocumentLoader;
    let schemaDirectory: SchemaDirectory;

    beforeEach(async () => {
        documentLoader = new FileSystemDocumentLoader([schemaDir_10, schemaDir_11], true);
        schemaDirectory = new SchemaDirectory(documentLoader);
        await schemaDirectory.loadSchemas();
    });

    it('validates architecture against pattern with options', async () => {
        const inputPattern = JSON.parse(readFileSync(inputPatternPath, 'utf-8'));
        const inputArch = JSON.parse(readFileSync(inputArchPath, 'utf-8'));
        const response = await validate(inputArch, inputPattern, schemaDirectory, true);

        expect(response).not.toBeNull();
        expect(response).not.toBeUndefined();
        expect(response.hasErrors).toBeTruthy();
        // expect(response.hasWarnings).toBeTruthy();
        expect(response.jsonSchemaValidationOutputs).toHaveLength(1);
        expect(response.jsonSchemaValidationOutputs[0].path).toBe('/nodes/1/node-type');
        expect(response.spectralSchemaValidationOutputs).toHaveLength(2);
        expect(response.spectralSchemaValidationOutputs[0].path).toBe('/nodes/0/description');
        expect(response.spectralSchemaValidationOutputs[1].path).toBe('/nodes/1/description');
    });

    it('reports json schema compilation errors for bad-json-schema fixture', async () => {
        const badPattern = JSON.parse(readFileSync(badPatternPath, 'utf-8'));
        const inputArch = JSON.parse(readFileSync(inputArchPath, 'utf-8'));

        const response = await validate(inputArch, badPattern, schemaDirectory, false);

        expect(response.hasErrors).toBeTruthy();
        expect(response.jsonSchemaValidationOutputs).toHaveLength(1);
        expect(response.jsonSchemaValidationOutputs[0].message).toContain('type');
        expect(response.jsonSchemaValidationOutputs[0].path).toBe('/');
    });

    it('reports spectral issue for architecture with empty string property', async () => {
        const inputArch = JSON.parse(readFileSync(path.join(validationPath, 'empty-string-property.json'), 'utf-8'));
        const pattern = await schemaDirectory.getSchema(inputArch['$schema']);

        const response = await validate(inputArch, pattern, schemaDirectory, false);

        expect(response.hasErrors).toBeTruthy();
        expect(response.spectralSchemaValidationOutputs).toHaveLength(1);
        expect(response.spectralSchemaValidationOutputs[0].message).toContain('nonempty value');
        expect(response.spectralSchemaValidationOutputs[0].path).toBe('/nodes/0/description');
    });

    it('does not report spectral issue for architecture with false boolean property', async () => {
        // If we prohibit false, then there is no way to represent a boolean property set to false in the architecture.
        const inputArch = JSON.parse(readFileSync(path.join(validationPath, 'false-boolean-property.json'), 'utf-8'));
        const pattern = await schemaDirectory.getSchema(inputArch['$schema']);

        const response = await validate(inputArch, pattern, schemaDirectory, false);

        expect(response.hasErrors).toBeFalsy();
    });

    it('does not report spectral issue for architecture with zero integer property', async () => {
        // If we prohibit 0, then there is no way to represent the number zero in the architecture.
        const inputArch = JSON.parse(readFileSync(path.join(validationPath, 'zero-integer-property.json'), 'utf-8'));
        const pattern = await schemaDirectory.getSchema(inputArch['$schema']);

        const response = await validate(inputArch, pattern, schemaDirectory, false);

        expect(response.hasErrors).toBeFalsy();
    });

    describe('applyArchitectureOptionsToPattern', () => {
        it('works with one options relationship', async () => {
            const architecture = JSON.parse(
                readFileSync(inputArchPath, 'utf8')
            );
            const pattern = JSON.parse(
                readFileSync(inputPatternPath, 'utf8')
            );
            const expectedResult = JSON.parse(
                readFileSync(path.join(__dirname, '../../../test_fixtures/command/validate/options/pattern-resolved.json'), 'utf8')
            );

            const newPattern = applyArchitectureOptionsToPattern(architecture, pattern, false);
            expect(newPattern).toStrictEqual(expectedResult);
        });
    });

    describe('schema specific validations', () => {
        it('fails to report bad flows for schema 1.0', async () => {
            const inputArch = JSON.parse(readFileSync(path.join(validationPath, 'flows/flows-1.0-bad.json'), 'utf-8'));
            const schema = await schemaDirectory.getSchema(inputArch['$schema']);

            const response = await validate(inputArch, schema, schemaDirectory, false);

            expect(response.hasErrors).toBeFalsy(); // schema 1.0 has a bug in flow definition
        });

        it('reports bad flows for schema 1.1', async () => {
            const inputArch = JSON.parse(readFileSync(path.join(validationPath, 'flows/flows-1.1-bad.json'), 'utf-8'));
            const schema = await schemaDirectory.getSchema(inputArch['$schema']);

            const response = await validate(inputArch, schema, schemaDirectory, false);

            expect(response.hasErrors).toBeTruthy();
            expect(response.jsonSchemaValidationOutputs).toHaveLength(3);
            expect(response.jsonSchemaValidationOutputs[0].message).toContain('relationship-unique-id');
            expect(response.jsonSchemaValidationOutputs[0].path).toBe('/flows/0/transitions/0');
        });

        it('accepts good flows for schema 1.1', async () => {
            const inputArch = JSON.parse(readFileSync(path.join(validationPath, 'flows/flows-1.1-good.json'), 'utf-8'));
            const schema = await schemaDirectory.getSchema(inputArch['$schema']);

            const response = await validate(inputArch, schema, schemaDirectory, false);

            expect(response.hasErrors).toBeFalsy();
        });

        it('error in flow with non-unique sequence numbers', async () => {
            const inputArch = JSON.parse(readFileSync(path.join(validationPath, 'flows/flows-spectral-sequence-non-unique.json'), 'utf-8'));
            const schema = await schemaDirectory.getSchema(inputArch['$schema']);

            const response = await validate(inputArch, schema, schemaDirectory, false);

            expect(response.hasErrors).toBeTruthy();
            expect(response.spectralSchemaValidationOutputs).toHaveLength(1);
            expect(response.spectralSchemaValidationOutputs[0].message).toContain('sequence-number');
            expect(response.spectralSchemaValidationOutputs[0].path).toBe('/flows/0/transitions');
        });

        it('error in flow with unknown relationship', async () => {
            const inputArch = JSON.parse(readFileSync(path.join(validationPath, 'flows/flows-spectral-unknown-relationship.json'), 'utf-8'));
            const schema = await schemaDirectory.getSchema(inputArch['$schema']);

            const response = await validate(inputArch, schema, schemaDirectory, false);

            expect(response.hasErrors).toBeTruthy();
            expect(response.spectralSchemaValidationOutputs).toHaveLength(1);
            expect(response.spectralSchemaValidationOutputs[0].message).toContain('does not refer to the unique-id');
            expect(response.spectralSchemaValidationOutputs[0].path).toBe('/flows/0/transitions/0/relationship-unique-id');
        });
    });
});
