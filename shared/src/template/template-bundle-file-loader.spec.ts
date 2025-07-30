import fs from 'fs';
import path from 'path';
import { TemplateBundleFileLoader, SelfProvidedTemplateLoader, SelfProvidedDirectoryTemplateLoader} from './template-bundle-file-loader';
import { IndexFile } from './types';
import { Mock } from 'vitest';

vi.mock('fs');

describe('TemplateBundleFileLoader', () => {
    const mockBundlePath = '/mock/template-bundle';
    const mockIndexJsonPath = path.join(mockBundlePath, 'index.json');
    const mockTemplateFiles = {
        'template1.hbs': '{{name}} template',
        'template2.hbs': '{{name}} another template',
    };

    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('should load index.json and template files correctly', () => {
        (fs.existsSync as Mock).mockImplementation((filePath) => {
            return filePath === mockIndexJsonPath || Object.keys(mockTemplateFiles).includes(path.basename(filePath));
        });

        (fs.readFileSync as Mock).mockImplementation((filePath: string) => {
            if (filePath === mockIndexJsonPath) {
                return JSON.stringify({
                    name: 'mock-template',
                    transformer: 'mock-transformer',
                    templates: [{ template: 'template1.hbs', from: 'data', output: 'output.md', 'output-type': 'single' }]
                } as IndexFile);
            }
            return mockTemplateFiles[path.basename(filePath)];
        });

        (fs.readdirSync as Mock).mockReturnValue(Object.keys(mockTemplateFiles));

        const loader = new TemplateBundleFileLoader(mockBundlePath);

        expect(loader.getConfig()).toEqual({
            name: 'mock-template',
            transformer: 'mock-transformer',
            templates: [{ template: 'template1.hbs', from: 'data', output: 'output.md', 'output-type': 'single' }]
        });

        expect(loader.getTemplateFiles()).toEqual(mockTemplateFiles);
    });

    it('should throw an error if index.json is missing', () => {
        (fs.existsSync as Mock).mockReturnValue(false);

        expect(() => new TemplateBundleFileLoader(mockBundlePath))
            .toThrowError(`index.json not found in template bundle: ${mockIndexJsonPath}`);
    });

    it('should throw an error if index.json is malformed', () => {
        (fs.existsSync as Mock).mockReturnValue(true);
        (fs.readFileSync as Mock).mockReturnValue('{ invalid-json }');

        expect(() => new TemplateBundleFileLoader(mockBundlePath))
            .toThrowError(/Failed to parse index.json/);
    });

    it('should throw an error if index.json is missing required fields', () => {
        (fs.existsSync as Mock).mockReturnValue(true);
        (fs.readFileSync as Mock).mockReturnValue(JSON.stringify({}));

        expect(() => new TemplateBundleFileLoader(mockBundlePath))
            .toThrowError('Invalid index.json format: Missing required fields');
    });

    it('should return an empty object if no template files exist', () => {
        (fs.existsSync as Mock).mockImplementation((filePath) => filePath === mockIndexJsonPath);
        (fs.readFileSync as Mock).mockImplementation((filePath: string) => {
            if (filePath === mockIndexJsonPath) {
                return JSON.stringify({
                    name: 'mock-template',
                    transformer: 'mock-transformer',
                    templates: [],
                });
            }
            return '';
        });

        (fs.readdirSync as Mock).mockReturnValue([]);

        const loader = new TemplateBundleFileLoader(mockBundlePath);
        expect(loader.getTemplateFiles()).toEqual({});
    });
});


describe('SelfProvidedTemplateLoader', () => {
    const templatePath = '/mock/single/template.md';
    const templateContent = '# Hello {{name}}';
    const outputPath = '/mock/output/output.md';

    beforeEach(() => {
        vi.resetAllMocks();
        (fs.readFileSync as Mock).mockReturnValue(templateContent);
        (fs.existsSync as Mock).mockReturnValue(true);
        (fs.statSync as Mock).mockReturnValue({ isDirectory: () => false });
    });

    it('should load a single template and default output file correctly', () => {
        const loader = new SelfProvidedTemplateLoader(templatePath, outputPath);

        expect(loader.getTemplateFiles()).toEqual({
            'template.md': templateContent,
        });

        expect(loader.getConfig()).toEqual({
            name: 'Self Provided Template',
            templates: [{
                template: 'template.md',
                from: 'document',
                output: 'output.md',
                'output-type': 'single'
            }]
        });
    });

    it('should default output file to "output.md" if output path is a directory', () => {
        (fs.statSync as Mock).mockReturnValue({ isDirectory: () => true });

        const loader = new SelfProvidedTemplateLoader(templatePath, '/mock/output/');
        expect(loader.getConfig().templates[0].output).toBe('output.md');
    });
});

describe('SelfProvidedDirectoryTemplateLoader', () => {
    const templateDir = '/mock/templates';
    const files = ['doc1.md', 'doc2.hbs', 'readme.txt'];
    const fileContents = {
        'doc1.md': '# Markdown template',
        'doc2.hbs': '{{data}} handlebars template',
        'readme.txt': ''
    };

    beforeEach(() => {
        vi.resetAllMocks();

        (fs.readdirSync as Mock).mockReturnValue(files);
        (fs.readFileSync as Mock).mockImplementation((filePath: string) => {
            const fileName = path.basename(filePath);
            return fileContents[fileName] || '';
        });
        (fs.existsSync as Mock).mockReturnValue(true);
        (fs.statSync as Mock).mockReturnValue({ isDirectory: () => true });
    });

    it('should load all .md and .hbs files and build config entries', () => {
        const loader = new SelfProvidedDirectoryTemplateLoader(templateDir);

        expect(loader.getTemplateFiles()).toEqual({
            'doc1.md': '# Markdown template',
            'doc2.hbs': '{{data}} handlebars template',
            'readme.txt': ''
        });

        expect(loader.getConfig()).toEqual({
            name: 'Self Provided Template Directory',
            templates: [
                {
                    template: 'doc1.md',
                    from: 'document',
                    output: 'doc1.md',
                    'output-type': 'single'
                },
                {
                    template: 'doc2.hbs',
                    from: 'document',
                    output: 'doc2.hbs',
                    'output-type': 'single'
                },
                {
                    template: 'readme.txt',
                    from: 'document',
                    output: 'readme.txt',
                    'output-type': 'single'
                }
            ]
        });
    });
});
