import { TemplateEngine } from './template-engine';
import { TemplateBundleFileLoader } from './template-bundle-file-loader';
import { CalmTemplateTransformer, IndexFile } from './types';
import fs from 'fs';
import path from 'path';

vi.mock('fs');

describe('TemplateEngine', () => {
    let mockFileLoader: vi.mocked<TemplateBundleFileLoader>;
    let mockTransformer: vi.mocked<CalmTemplateTransformer>;
    let loggerInfoSpy: vi.SpyInstance;
    let loggerWarnSpy: vi.SpyInstance;

    beforeEach(() => {
        mockFileLoader = {
            getConfig: vi.fn(),
            getTemplateFiles: vi.fn(),
        } as unknown as vi.mocked<TemplateBundleFileLoader>;

        mockTransformer = {
            registerTemplateHelpers: vi.fn().mockReturnValue({}),
            getTransformedModel: vi.fn(),
        } as unknown as vi.mocked<CalmTemplateTransformer>;

        loggerInfoSpy = vi.spyOn(TemplateEngine['logger'], 'info').mockImplementation(vi.fn());
        loggerWarnSpy = vi.spyOn(TemplateEngine['logger'], 'warn').mockImplementation(vi.fn());
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
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

        vi.spyOn(fs, 'existsSync').mockReturnValue(false);
        const mkdirSyncSpy = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
        const writeFileSyncSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

        const engine = new TemplateEngine(mockFileLoader, mockTransformer);

        const userData = {
            users: [
                { id: '1', name: 'Alice' },
                { id: '2', name: 'Bob' },
            ],
        };

        engine.generate(userData, '/output');

        expect(mkdirSyncSpy).toHaveBeenCalledWith('/output', { recursive: true });
        expect(mkdirSyncSpy).toHaveBeenCalledWith(path.dirname('/output/1.txt'), { recursive: true });
        expect(mkdirSyncSpy).toHaveBeenCalledWith(path.dirname('/output/2.txt'), { recursive: true });
        expect(writeFileSyncSpy).toHaveBeenCalledTimes(2);
        expect(writeFileSyncSpy).toHaveBeenCalledWith('/output/1.txt', 'User: Alice', 'utf8');
        expect(writeFileSyncSpy).toHaveBeenCalledWith('/output/2.txt', 'User: Bob', 'utf8');
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

        vi.spyOn(fs, 'existsSync').mockReturnValue(false);
        const mkdirSyncSpy = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
        const writeFileSyncSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

        const engine = new TemplateEngine(mockFileLoader, mockTransformer);

        const testData = { data: { id: '123', name: 'Alice' } };

        engine.generate(testData, '/output');

        expect(mkdirSyncSpy).toHaveBeenCalledWith('/output', { recursive: true });
        expect(mkdirSyncSpy).toHaveBeenCalledWith(path.dirname('/output/output.txt'), { recursive: true });
        expect(writeFileSyncSpy).toHaveBeenCalledTimes(1);
        expect(writeFileSyncSpy).toHaveBeenCalledWith('/output/output.txt', 'User: Alice', 'utf8');
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
