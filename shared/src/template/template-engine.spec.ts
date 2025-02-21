import { TemplateEngine } from './template-engine';
import { TemplateBundleFileLoader } from './template-bundle-file-loader';
import { CalmTemplateTransformer, IndexFile } from './types';
import fs from 'fs';

jest.mock('fs');

describe('TemplateEngine', () => {
    let mockFileLoader: jest.Mocked<TemplateBundleFileLoader>;
    let mockTransformer: jest.Mocked<CalmTemplateTransformer>;
    let loggerInfoSpy: jest.SpyInstance;
    let loggerWarnSpy: jest.SpyInstance;

    beforeEach(() => {
        mockFileLoader = {
            getConfig: jest.fn(),
            getTemplateFiles: jest.fn(),
        } as unknown as jest.Mocked<TemplateBundleFileLoader>;

        mockTransformer = {
            registerTemplateHelpers: jest.fn().mockReturnValue({}),
            getTransformedModel: jest.fn(),
        } as unknown as jest.Mocked<CalmTemplateTransformer>;

        loggerInfoSpy = jest.spyOn(TemplateEngine['logger'], 'info').mockImplementation(jest.fn());
        loggerWarnSpy = jest.spyOn(TemplateEngine['logger'], 'warn').mockImplementation(jest.fn());

    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.clearAllMocks();
    });

    it('should log compiled templates', () => {
        const templateConfig: IndexFile = {
            name: 'Test Template',
            transformer: 'mock-transformer',
            templates: [{ template: 'main.hbs', from: 'data', output: 'output.txt', 'output-type': 'single' }],
        };

        const templateFiles = {
            'main.hbs': 'User: {{name}}',
        };

        mockFileLoader.getConfig.mockReturnValue(templateConfig);
        mockFileLoader.getTemplateFiles.mockReturnValue(templateFiles);

        new TemplateEngine(mockFileLoader, mockTransformer);

        expect(loggerInfoSpy).toHaveBeenCalledWith('✅ Compiled 1 Templates');
    });

    it('should register template helpers', () => {
        const templateConfig: IndexFile = {
            name: 'Test Template',
            transformer: 'mock-transformer',
            templates: [{ template: 'main.hbs', from: 'data', output: 'output.txt', 'output-type': 'single' }],
        };

        const templateFiles = {
            'main.hbs': 'User: {{name}}',
        };

        mockFileLoader.getConfig.mockReturnValue(templateConfig);
        mockFileLoader.getTemplateFiles.mockReturnValue(templateFiles);

        mockTransformer.registerTemplateHelpers.mockReturnValue({
            uppercase: (str: string) => str.toUpperCase(),
        });

        new TemplateEngine(mockFileLoader, mockTransformer);

        expect(loggerInfoSpy).toHaveBeenCalledWith('🔧 Registering Handlebars Helpers...');
        expect(loggerInfoSpy).toHaveBeenCalledWith('✅ Registered helper: uppercase');
    });

    it('should log a warning for an unknown template', () => {
        const templateConfig: IndexFile = {
            name: 'Test Template',
            transformer: 'mock-transformer',
            templates: [{ template: 'unknown.hbs', from: 'data', output: 'output.txt', 'output-type': 'single' }],
        };

        mockFileLoader.getConfig.mockReturnValue(templateConfig);
        mockFileLoader.getTemplateFiles.mockReturnValue({});

        const engine = new TemplateEngine(mockFileLoader, mockTransformer);
        engine.generate({}, '/output');

        expect(loggerWarnSpy).toHaveBeenCalledWith('⚠️ Skipping unknown template: unknown.hbs');
    });

    it('should handle repeated output templates', () => {
        const templateConfig: IndexFile = {
            name: 'Test Template',
            transformer: 'mock-transformer',
            templates: [{ template: 'main.hbs', from: 'users', output: '{{id}}.txt', 'output-type': 'repeated' }],
        };

        const templateFiles = {
            'main.hbs': 'User: {{name}}',
        };

        mockFileLoader.getConfig.mockReturnValue(templateConfig);
        mockFileLoader.getTemplateFiles.mockReturnValue(templateFiles);

        jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

        const engine = new TemplateEngine(mockFileLoader, mockTransformer);

        const userData = {
            users: [
                { id: '1', name: 'Alice' },
                { id: '2', name: 'Bob' },
            ],
        };

        engine.generate(userData, '/output');

        expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
        expect(fs.writeFileSync).toHaveBeenCalledWith('/output/1.txt', 'User: Alice', 'utf8');
        expect(fs.writeFileSync).toHaveBeenCalledWith('/output/2.txt', 'User: Bob', 'utf8');
    });

    it('should handle single output templates', () => {
        const templateConfig: IndexFile = {
            name: 'Test Template',
            transformer: 'mock-transformer',
            templates: [{ template: 'main.hbs', from: 'data', output: 'output.txt', 'output-type': 'single' }],
        };

        const templateFiles = {
            'main.hbs': 'User: {{name}}',
        };

        mockFileLoader.getConfig.mockReturnValue(templateConfig);
        mockFileLoader.getTemplateFiles.mockReturnValue(templateFiles);

        jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

        const engine = new TemplateEngine(mockFileLoader, mockTransformer);

        const testData = { data: { id: '123', name: 'Alice' } };

        engine.generate(testData, '/output');

        expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
        expect(fs.writeFileSync).toHaveBeenCalledWith('/output/output.txt', 'User: Alice', 'utf8');
    });

    it('should log a warning when registering a missing partial template', () => {
        const templateConfig: IndexFile = {
            name: 'Test Template',
            transformer: 'mock-transformer',
            templates: [{ template: 'main.hbs', from: 'data', output: 'output.txt', 'output-type': 'single', partials: ['header.hbs'] }],
        };

        const templateFiles = {
            'main.hbs': 'User: {{name}}',
        };

        mockFileLoader.getConfig.mockReturnValue(templateConfig);
        mockFileLoader.getTemplateFiles.mockReturnValue(templateFiles);

        const engine = new TemplateEngine(mockFileLoader, mockTransformer);
        engine.generate({ data: { name: 'Alice' } }, '/output');

        expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('⚠️ Missing partial template: header.hbs'));
    });

    it('should log a warning for non-array input when expecting repeated output', () => {
        const templateConfig: IndexFile = {
            name: 'Test Template',
            transformer: 'mock-transformer',
            templates: [{ template: 'main.hbs', from: 'data', output: 'output.txt', 'output-type': 'repeated' }],
        };

        const templateFiles = {
            'main.hbs': 'User: {{name}}',
        };

        mockFileLoader.getConfig.mockReturnValue(templateConfig);
        mockFileLoader.getTemplateFiles.mockReturnValue(templateFiles);

        const engine = new TemplateEngine(mockFileLoader, mockTransformer);
        engine.generate({ data: { id: '1', name: 'Alice' } }, '/output');

        expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('⚠️ Expected array for repeated output, but found non-array for main.hbs'));
    });

    it('should log a warning for an unknown output type', () => {
        const templateConfig: IndexFile = {
            name: 'Test Template',
            transformer: 'mock-transformer',
            templates: [{ template: 'main.hbs', from: 'data', output: 'output.txt', 'output-type': 'invalid-type' }],
        };

        const templateFiles = {
            'main.hbs': 'User: {{name}}',
        };

        mockFileLoader.getConfig.mockReturnValue(templateConfig);
        mockFileLoader.getTemplateFiles.mockReturnValue(templateFiles);

        const engine = new TemplateEngine(mockFileLoader, mockTransformer);
        engine.generate({ data: { id: '1', name: 'Alice' } }, '/output');

        expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('⚠️ Unknown output-type: invalid-type'));
    });

    it('should log when registering a partial template', () => {
        const templateConfig: IndexFile = {
            name: 'Test Template',
            transformer: 'mock-transformer',
            templates: [
                { template: 'main.hbs', from: 'data', output: 'output.txt', 'output-type': 'single', partials: ['header.hbs'] }
            ],
        };

        const templateFiles = {
            'main.hbs': 'User: {{name}}',
            'header.hbs': '<h1>{{title}}</h1>',
        };

        mockFileLoader.getConfig.mockReturnValue(templateConfig);
        mockFileLoader.getTemplateFiles.mockReturnValue(templateFiles);

        const engine = new TemplateEngine(mockFileLoader, mockTransformer);
        engine.generate({ data: { name: 'Alice' } }, '/output');

        expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('✅ Registering partial template: header.hbs'));
    });





});
