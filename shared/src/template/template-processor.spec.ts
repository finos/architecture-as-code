/* eslint-disable  @typescript-eslint/no-explicit-any */
import fs from 'fs';
import path from 'path';
import { TemplateProcessor } from './template-processor';
import { CalmTemplateTransformer, IndexFile } from './types';

jest.mock('fs');

const fakeConfig: IndexFile = {
    name: 'Test Bundle',
    transformer: 'mock-transformer',
    templates: [
        { template: 'main.hbs', from: 'data', output: 'output.txt', 'output-type': 'single' },
        { template: 'main.hbs', from: 'users', output: '{{id}}.txt', 'output-type': 'repeated' }
    ]
};

const fakeTemplateFiles = {
    'main.hbs': 'User: {{name}}'
};

const mockTemplateLoader = {
    getConfig: jest.fn().mockReturnValue(fakeConfig),
    getTemplateFiles: jest.fn().mockReturnValue(fakeTemplateFiles),
};

jest.mock('./template-bundle-file-loader', () => {
    return {
        TemplateBundleFileLoader: jest.fn().mockImplementation(() => mockTemplateLoader)
    };
});

const mockTemplateEngine = {
    generate: jest.fn()
};

jest.mock('./template-engine', () => {
    return {
        TemplateEngine: jest.fn().mockImplementation(() => mockTemplateEngine)
    };
});

// --- Spy on the static logger of TemplateProcessor
describe('TemplateProcessor', () => {
    let mockTransformer: jest.Mocked<CalmTemplateTransformer>;
    let loggerInfoSpy: jest.SpyInstance;
    let loggerErrorSpy: jest.SpyInstance;

    beforeEach(() => {
        // Create a fake transformer that returns a dummy transformed model.
        mockTransformer = {
            registerTemplateHelpers: jest.fn().mockReturnValue({}),
            getTransformedModel: jest.fn().mockReturnValue({ transformed: true }),
        } as unknown as jest.Mocked<CalmTemplateTransformer>;

        loggerInfoSpy = jest.spyOn(TemplateProcessor['logger'], 'info').mockImplementation(jest.fn());
        loggerErrorSpy = jest.spyOn(TemplateProcessor['logger'], 'error').mockImplementation(jest.fn());

        jest.spyOn(TemplateProcessor.prototype as any, 'loadTransformer').mockReturnValue(mockTransformer);


        (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
            return !filePath.includes('missing');

        });
        (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
            if (filePath.includes('simple-nodes.json')) return '{"some": "data"}';
            return '';
        });
        (fs.rmSync as jest.Mock).mockImplementation(() => {});
        (fs.mkdirSync as jest.Mock).mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.clearAllMocks();
    });

    it('should successfully process a template', async () => {
        const processor = new TemplateProcessor('simple-nodes.json', 'bundle', 'output');
        await processor.processTemplate();

        expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('🗑️ Cleaning up previous generation...'));
        expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('✅ Template Generation Completed!'));
        expect(mockTemplateEngine.generate).toHaveBeenCalled();
    });

    it('should throw an error if the input file is missing', async () => {
        (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
            return !filePath.includes('simple-nodes.json');
        });

        const processor = new TemplateProcessor('simple-nodes.json', 'bundle', 'output');

        await expect(processor.processTemplate()).rejects.toThrow('CALM model file not found: ' + path.resolve('simple-nodes.json'));
        expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('❌ CALM model file not found'));
    });

    it('should throw an error if the transformer field is missing in config', async () => {
        const configNoTransformer = {
            name: 'Test Bundle',
            templates: []
        };
        mockTemplateLoader.getConfig.mockReturnValue(configNoTransformer);

        const processor = new TemplateProcessor('simple-nodes.json', 'bundle', 'output');

        await expect(processor.processTemplate()).rejects.toThrow(
            'Missing "transformer" field in index.json. Define a transformer for this template bundle.'
        );
        expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('❌ Missing "transformer" field in index.json.'));
    });

    it('should throw an error if loadTransformer fails', async () => {
        const configWithBadTransformer = {
            name: 'Test Bundle',
            templates: [],
            transformer: 'NonExistentTransformer'
        };

        mockTemplateLoader.getConfig.mockReturnValue(configWithBadTransformer);

        jest.spyOn(TemplateProcessor.prototype as any, 'loadTransformer').mockImplementation(() => {
            throw new Error('TransformerClass is undefined.');
        });

        const processor = new TemplateProcessor('simple-nodes.json', 'bundle', 'output');

        await expect(processor.processTemplate()).rejects.toThrow('❌ Error generating template: TransformerClass is undefined.');
        expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('❌ Error generating template: TransformerClass is undefined.'));
    });

});
