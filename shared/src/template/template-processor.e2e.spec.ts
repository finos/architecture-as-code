import fs from 'fs';
import path from 'path';
import { TemplateProcessor } from './template-processor';

const FIXTURES_DIR = path.resolve(__dirname, '../../test_fixtures/template');
const OUTPUT_DIR = path.join(FIXTURES_DIR, 'generated-output');
const DATA_DIR = path.join(FIXTURES_DIR, 'data');
const EXPECTED_OUTPUT_DIR = path.join(FIXTURES_DIR, 'expected-output');

describe('TemplateProcessor E2E', () => {

    beforeEach(() => {
        if (fs.existsSync(OUTPUT_DIR)) {
            fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
        }
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    });

    afterAll(() => {
        if (fs.existsSync(OUTPUT_DIR)) {
            fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
        }
    });


    it('should successfully process a simple bundle', async () => {
        const processor = new TemplateProcessor(
            path.join(DATA_DIR, 'simple-nodes.json'),
            path.join(FIXTURES_DIR, 'bundles/single-file'),
            OUTPUT_DIR,
            new Map<string, string>()
        );
        await processor.processTemplate();

        const expectedFiles = ['users.txt'];
        expectedFiles.forEach(file => {
            expect(fs.existsSync(path.join(OUTPUT_DIR, file))).toBe(true);
        });
    });

    it('should throw an error if input JSON is missing', async () => {
        const processor = new TemplateProcessor(
            path.join(DATA_DIR, 'missing.json'),
            path.join(FIXTURES_DIR, 'bundles/single-file'),
            OUTPUT_DIR,
            new Map<string, string>()
        );
        await expect(processor.processTemplate()).rejects.toThrow('CALM model file not found');
    });

    it('should throw an error if index.json is missing in the template bundle', async () => {
        const processor = new TemplateProcessor(
            path.join(DATA_DIR, 'simple-nodes.json'),
            path.join(FIXTURES_DIR, 'bundles/missing-index'),
            OUTPUT_DIR,
            new Map<string, string>()
        );
        await expect(processor.processTemplate()).rejects.toThrow('index.json not found in template bundle');
    });

    it('should throw an error if transformer file is missing', async () => {
        const processor = new TemplateProcessor(
            path.join(DATA_DIR, 'simple-nodes.json'),
            path.join(FIXTURES_DIR, 'bundles/missing-transformer'),
            OUTPUT_DIR,
            new Map<string, string>()
        );
        await expect(processor.processTemplate()).rejects.toThrow('Transformer file not found');
    });

    it('should throw an error if transformer does not export a class', async () => {
        const processor = new TemplateProcessor(
            path.join(DATA_DIR, 'simple-nodes.json'),
            path.join(FIXTURES_DIR, 'bundles/bad-transformer'),
            OUTPUT_DIR,
            new Map<string, string>()
        );
        await expect(processor.processTemplate()).rejects.toThrow('❌ Error generating template: ❌ Error loading transformer: TransformerClass is not a constructor');
    });

    it('should throw an error if transformer throws an exception', async () => {
        const processor = new TemplateProcessor(
            path.join(DATA_DIR, 'simple-nodes.json'),
            path.join(FIXTURES_DIR, 'bundles/failing-transformer'),
            OUTPUT_DIR,
            new Map<string, string>()
        );
        await expect(processor.processTemplate()).rejects.toThrow('Error loading transformer');
    });

    it('should process a bundle with partial templates', async () => {
        const processor = new TemplateProcessor(
            path.join(DATA_DIR, 'document-system.json'),
            path.join(FIXTURES_DIR, 'bundles/with-partials'),
            OUTPUT_DIR,
            new Map<string, string>()
        );
        await processor.processTemplate();

        const actualFile = path.join(OUTPUT_DIR, 'actual-with-partials.txt');
        const expectedFile = path.join(EXPECTED_OUTPUT_DIR, 'with-partials.txt');

        expect(fs.existsSync(actualFile)).toBe(true);  // Ensure the file exists

        const actualContent = fs.readFileSync(actualFile, 'utf8').trim();
        const expectedContent = fs.readFileSync(expectedFile, 'utf8').trim();

        expect(actualContent).toEqual(expectedContent); // Compare file contents
    });

    it('should process a bundle with repeated output', async () => {
        const processor = new TemplateProcessor(
            path.join(DATA_DIR, 'simple-nodes.json'),
            path.join(FIXTURES_DIR, 'bundles/repeated'),
            OUTPUT_DIR,
            new Map<string, string>()
        );
        await processor.processTemplate();

        const expectedFiles = ['service-a.txt', 'service-b.txt'];
        expectedFiles.forEach(file => {
            expect(fs.existsSync(path.join(OUTPUT_DIR, file))).toBe(true);
        });
    });

    it('should process a bundle using a JavaScript transformer', async () => {
        const processor = new TemplateProcessor(
            path.join(DATA_DIR, 'document-system.json'),
            path.join(FIXTURES_DIR, 'bundles/js-transformer'),
            OUTPUT_DIR,
            new Map<string, string>()
        );
        await processor.processTemplate();

        const actualFile = path.join(OUTPUT_DIR, 'js-transformer.txt');
        const expectedFile = path.join(EXPECTED_OUTPUT_DIR, 'js-transformer.txt');

        expect(fs.existsSync(actualFile)).toBe(true);

        const actualContent = fs.readFileSync(actualFile, 'utf8').trim();
        const expectedContent = fs.readFileSync(expectedFile, 'utf8').trim();

        expect(actualContent).toEqual(expectedContent);
    });

    it('should process a bundle with URL dereferencing', async () => {
        const mapping = new Map<string, string>([
            ['https://calm.finos.org/docuflow/flow/document-upload', path.join(DATA_DIR, 'flow-document-upload.json')]
        ]);
        const processor = new TemplateProcessor(
            path.join(DATA_DIR, 'document-system.json'),
            path.join(FIXTURES_DIR, 'bundles/dereferencing-transformer'),
            OUTPUT_DIR,
            mapping
        );
        await processor.processTemplate();
        const actualFile = path.join(OUTPUT_DIR, 'deref-output.html');
        const expectedFile = path.join(EXPECTED_OUTPUT_DIR, 'deref-output.html');
        expect(fs.existsSync(actualFile)).toBe(true);
        const actualContent = fs.readFileSync(actualFile, 'utf8').trim();
        const expectedContent = fs.readFileSync(expectedFile, 'utf8').trim();
        expect(actualContent).toEqual(expectedContent);
    });


});
