import fs from 'fs';
import path, {join} from 'path';
import { promises as fsPromises } from 'fs';
import { TemplateProcessor } from './template-processor';
import {CalmNodeSchema} from '../types/core-types';
import {CalmInterfaceTypeSchema} from '../types/interface-types';
const FIXTURES_DIR = path.resolve(__dirname, '../../test_fixtures/template');
const WORKSHOP_DIR = path.resolve(__dirname, '../../../calm/workshop');
const WORKSHOP_ARCH_DIR = path.resolve(__dirname, '../../test_fixtures/command/generate/expected-output');
const OUTPUT_DIR = path.join(FIXTURES_DIR, 'generated-output');
const DATA_DIR = path.join(FIXTURES_DIR, 'data');
const EXPECTED_OUTPUT_DIR = path.join(FIXTURES_DIR, 'expected-output');

describe('TemplateProcessor E2E', () => {
    const normalizeLineEndings = (str) => str.replace(/\r?\n/g, '\n');

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
    it('should throw an error if specified transformer file is missing', async () => {
        const bundlePath = path.join(FIXTURES_DIR, 'bundles/missing-transformer');
        const transformerName = 'no-transformer';
        const expectedErrorMessage = `❌ Error generating template: ❌ Transformer "${transformerName}" specified in index.json but not found as .ts or .js in ${bundlePath}`;

        const processor = new TemplateProcessor(
            path.join(DATA_DIR, 'simple-nodes.json'),
            bundlePath,
            OUTPUT_DIR,
            new Map<string, string>()
        );

        await expect(processor.processTemplate()).rejects.toThrow(expectedErrorMessage);
    });

    it('should throw an error if transformer does not export a class', async () => {
        const processor = new TemplateProcessor(
            path.join(DATA_DIR, 'simple-nodes.json'),
            path.join(FIXTURES_DIR, 'bundles/bad-transformer'),
            OUTPUT_DIR,
            new Map<string, string>()
        );
        await expect(processor.processTemplate()).rejects.toThrow('❌ Error generating template: ❌ Error loading transformer: ❌ TransformerClass is not a constructor. Did you forget to export default?');
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

    it('should use TemplateDefaultTransformer when no transformer is specified', async () => {
        const mapping = new Map<string, string>([
            ['https://calm.finos.org/docuflow/flow/document-upload', path.join(DATA_DIR, 'flow-document-upload.json')],
            ['https://calm.finos.org/controls/owner-responsibility.requirement.json', path.join(DATA_DIR, 'controls', 'owner-responsibility.requirement.json')],
            ['https://calm.finos.org/controls/architect.configuration.json', path.join(DATA_DIR, 'controls', 'architect.configuration.json')],
            ['https://calm.finos.org/controls/system-owner.configuration.json', path.join(DATA_DIR, 'controls', 'system-owner.configuration.json')],
            ['https://calm.finos.org/controls/business-owner.configuration.json', path.join(DATA_DIR, 'controls', 'business-owner.configuration.json')],
        ]);

        const processor = new TemplateProcessor(
            path.join(DATA_DIR, 'document-system-with-controls.json'),
            path.join(FIXTURES_DIR, 'bundles', 'default-transformer'),
            OUTPUT_DIR,
            mapping
        );

        await expect(processor.processTemplate()).resolves.not.toThrow();

        const actualFile = path.join(OUTPUT_DIR, 'doc-system-one-pager.md');
        const expectedFile = path.join(EXPECTED_OUTPUT_DIR, 'doc-system-one-pager.md');
        expect(fs.existsSync(actualFile)).toBe(true);
        const actualContent = normalizeLineEndings(fs.readFileSync(actualFile, 'utf8').trim());
        const expectedContent = normalizeLineEndings(fs.readFileSync(expectedFile, 'utf8').trim());
        expect(actualContent).toEqual(expectedContent);

    });


    function simulateAmendmentsPostGenerate(archPath,amendedPath){

        const original = fs.readFileSync(archPath, 'utf-8');

        const AMENDMENTS = {
            'load-balancer': {
                'load-balancer-host-port': { port: 80, host: 'localhost' }
            },
            'attendees': {
                'attendees-image': { image: 'masteringapi/attendees-quarkus:ws-native-db' },
                'attendees-port': { port: 8080 }
            },
            'attendees-store': {
                'database-image': { image: 'postgres-db:13' },
                'database-port': { port: 5432 }
            }
        };

        function amendNodeInterfaces(node: CalmNodeSchema) {
            const updates = AMENDMENTS[node['unique-id']];
            if (!updates) return;

            node.interfaces = node.interfaces.map((iface: CalmInterfaceTypeSchema) => {
                const patch = updates[iface['unique-id']];
                return patch ? { ...iface, ...patch } : iface;
            });
        }

        const model = JSON.parse(original);

        for (const node of model.nodes) {
            amendNodeInterfaces(node);
        }
        fs.writeFileSync(amendedPath, JSON.stringify(model, null, 2), 'utf-8');
    }

    it('Workshop Infrastructure As Code Example', async () => {
        const archPath = path.join(WORKSHOP_ARCH_DIR, 'conference-secure-signup.arch.json');
        const amendedPath = path.join(DATA_DIR, 'conference-secure-signup.amended.arch.json');
        simulateAmendmentsPostGenerate(archPath,amendedPath);
        const EXPECTED_OUTPUT_WORKSHOP_DIR = path.join(FIXTURES_DIR, 'expected-output/workshop/infrastructure');

        const mapping = new Map<string, string>([
            ['https://calm.finos.org/workshop/controls/micro-segmentation.config.json', join(WORKSHOP_DIR, 'controls/micro-segmentation.config.json')],
            ['https://calm.finos.org/workshop/controls/micro-segmentation.requirement.json', join(WORKSHOP_DIR, 'controls/micro-segmentation.requirement.json')],
            ['https://calm.finos.org/workshop/controls/permitted-connection.requirement.json', join(WORKSHOP_DIR, 'controls/permitted-connection.requirement.json')],
            ['https://calm.finos.org/workshop/controls/permitted-connection-http.config.json', join(WORKSHOP_DIR, 'controls/permitted-connection-http.config.json')],
            ['https://calm.finos.org/workshop/controls/permitted-connection-jdbc.config.json', join(WORKSHOP_DIR, 'controls/permitted-connection-jdbc.config.json')],
        ]);
        const processor = new TemplateProcessor(
            amendedPath,
            path.join(FIXTURES_DIR, 'bundles/infrastructure-transformer'),
            OUTPUT_DIR,
            mapping
        );

        await expect(processor.processTemplate()).resolves.not.toThrow();

        const actualFiles = await getAllFiles(OUTPUT_DIR);
        const expectedFiles = await getAllFiles(EXPECTED_OUTPUT_WORKSHOP_DIR);

        const actualRelPaths = new Set(actualFiles.map(f => relativeFilePath(OUTPUT_DIR, f)));
        const expectedRelPaths = new Set(expectedFiles.map(f => relativeFilePath(EXPECTED_OUTPUT_WORKSHOP_DIR, f)));

        // 🧪 Compare file lists
        expect(actualRelPaths).toEqual(expectedRelPaths);

        // 🧪 Compare contents
        for (const relPath of expectedRelPaths) {
            const actualContent = await fsPromises.readFile(path.join(OUTPUT_DIR, relPath), 'utf-8');
            const expectedContent = await fsPromises.readFile(path.join(EXPECTED_OUTPUT_WORKSHOP_DIR, relPath), 'utf-8');
            expect(actualContent).toEqual(expectedContent);
        }
    });

    async function getAllFiles(dir: string): Promise<string[]> {
        const dirents = await fsPromises.readdir(dir, { withFileTypes: true });
        const files = await Promise.all(
            dirents.map((dirent) => {
                const res = path.resolve(dir, dirent.name);
                return dirent.isDirectory() ? getAllFiles(res) : res;
            })
        );
        return files.flat();
    }

    function relativeFilePath(baseDir: string, fullPath: string): string {
        return path.relative(baseDir, fullPath);
    }

});
