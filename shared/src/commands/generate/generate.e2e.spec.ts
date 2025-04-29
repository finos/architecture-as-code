import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runGenerate } from './generate.js';
import { existsSync, readFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { FileSystemDocumentLoader } from '../../document-loader/file-system-document-loader.js';
import { SchemaDirectory } from '../../schema-directory.js';

const inputPatternPath = join(
    __dirname,
    '../../../../calm/workshop/conference-signup.pattern.json'
);
const inputSecurePatternPath = join(
    __dirname,
    '../../../../calm/workshop/conference-secure-signup.pattern.json'
);

const expectedDir = join(__dirname, '../../../test_fixtures/command/generate/expected-output');
const outputDir = join(__dirname, '../../../test_fixtures/command/generate/actual-output');
const schemaDir = join(__dirname, '../../../../calm/draft/2025-03/meta');

const outputPath = join(outputDir, 'conference-signup.arch.json');
const outputSecurePath = join(outputDir, 'conference-secure-signup.arch.json');

const expectedPlainPath = join(expectedDir, 'conference-signup.arch.json');
const expectedSecurePath = join(expectedDir, 'conference-secure-signup.arch.json');

describe('runGenerate E2E', () => {
    let schemaDirectory;
    beforeEach(() => {
        if (existsSync(outputDir)) {
            rmSync(outputDir, { recursive: true, force: true });
        }
        mkdirSync(outputDir, { recursive: true });
        schemaDirectory = new SchemaDirectory(new FileSystemDocumentLoader([schemaDir], true));
    });

    afterEach(() => {
        if (existsSync(outputDir)) {
            rmSync(outputDir, { recursive: true, force: true });
        }
    });

    it('generates output from pattern and matches expected file', async () => {
        const inputPattern = JSON.parse(readFileSync(inputPatternPath, 'utf-8'));
        await runGenerate(inputPattern, outputPath, true, schemaDirectory);

        expect(existsSync(outputPath)).toBe(true);

        const generated = JSON.parse(readFileSync(outputPath, 'utf-8'));
        const expected = JSON.parse(readFileSync(expectedPlainPath, 'utf-8'));

        expect(generated).toEqual(expected);
    });

    it('generates secure output from pattern and matches expected file', async () => {
        const inputSecurePattern = JSON.parse(readFileSync(inputSecurePatternPath, 'utf-8'));
        await runGenerate(inputSecurePattern, outputSecurePath, true, schemaDirectory);

        expect(existsSync(outputSecurePath)).toBe(true);

        const generated = JSON.parse(readFileSync(outputSecurePath, 'utf-8'));
        const expected = JSON.parse(readFileSync(expectedSecurePath, 'utf-8'));

        expect(generated).toEqual(expected);
    });
});
