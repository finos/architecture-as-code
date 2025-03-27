import fs from 'fs';
import path from 'path';
import { TemplateBundleFileLoader } from './template-bundle-file-loader';
import { IndexFile } from './types';

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
        (fs.existsSync as vi.mock).mockImplementation((filePath) => {
            return filePath === mockIndexJsonPath || Object.keys(mockTemplateFiles).includes(path.basename(filePath));
        });

        (fs.readFileSync as vi.mock).mockImplementation((filePath: string) => {
            if (filePath === mockIndexJsonPath) {
                return JSON.stringify({
                    name: 'mock-template',
                    transformer: 'mock-transformer',
                    templates: [{ template: 'template1.hbs', from: 'data', output: 'output.md', 'output-type': 'single' }]
                } as IndexFile);
            }
            return mockTemplateFiles[path.basename(filePath)];
        });

        (fs.readdirSync as vi.mock).mockReturnValue(Object.keys(mockTemplateFiles));

        const loader = new TemplateBundleFileLoader(mockBundlePath);

        expect(loader.getConfig()).toEqual({
            name: 'mock-template',
            transformer: 'mock-transformer',
            templates: [{ template: 'template1.hbs', from: 'data', output: 'output.md', 'output-type': 'single' }]
        });

        expect(loader.getTemplateFiles()).toEqual(mockTemplateFiles);
    });

    it('should throw an error if index.json is missing', () => {
        (fs.existsSync as vi.mock).mockReturnValue(false);

        expect(() => new TemplateBundleFileLoader(mockBundlePath))
            .toThrowError(`index.json not found in template bundle: ${mockIndexJsonPath}`);
    });

    it('should throw an error if index.json is malformed', () => {
        (fs.existsSync as vi.mock).mockReturnValue(true);
        (fs.readFileSync as vi.mock).mockReturnValue('{ invalid-json }');

        expect(() => new TemplateBundleFileLoader(mockBundlePath))
            .toThrowError(/Failed to parse index.json/);
    });

    it('should throw an error if index.json is missing required fields', () => {
        (fs.existsSync as vi.mock).mockReturnValue(true);
        (fs.readFileSync as vi.mock).mockReturnValue(JSON.stringify({}));

        expect(() => new TemplateBundleFileLoader(mockBundlePath))
            .toThrowError('Invalid index.json format: Missing required fields');
    });

    it('should return an empty object if no template files exist', () => {
        (fs.existsSync as vi.mock).mockImplementation((filePath) => filePath === mockIndexJsonPath);
        (fs.readFileSync as vi.mock).mockImplementation((filePath: string) => {
            if (filePath === mockIndexJsonPath) {
                return JSON.stringify({
                    name: 'mock-template',
                    transformer: 'mock-transformer',
                    templates: [],
                });
            }
            return '';
        });

        (fs.readdirSync as vi.mock).mockReturnValue([]);

        const loader = new TemplateBundleFileLoader(mockBundlePath);
        expect(loader.getTemplateFiles()).toEqual({});
    });
});
