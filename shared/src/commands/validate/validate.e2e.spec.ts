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

const schemaDir = path.join(__dirname, '../../../../calm/release/1.0/meta/');

describe('validate E2E', () => {
    let schemaDirectory;

    it('validates architecture against pattern with options', async () => {
        schemaDirectory = new SchemaDirectory(new FileSystemDocumentLoader([schemaDir], true));
        await schemaDirectory.loadSchemas();

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

            const newPattern = applyArchitectureOptionsToPattern(architecture, pattern);
            expect(newPattern).toStrictEqual(expectedResult);
        });
    });
});
