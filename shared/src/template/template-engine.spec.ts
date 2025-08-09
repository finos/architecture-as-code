import { TemplateEngine } from './template-engine';
import { TemplateBundleFileLoader } from './template-bundle-file-loader';
import { CalmTemplateTransformer, IndexFile } from './types';
import fs from 'fs';
import path from 'path';
import { vi } from 'vitest';
import { TemplatePreprocessor } from './template-preprocessor.js';
import { TemplatePathExtractor } from './template-path-extractor.js';

vi.mock('fs');
vi.mock('./template-preprocessor.js');
vi.mock('./template-path-extractor.js');

describe('TemplateEngine', () => {
    let mockFileLoader: ReturnType<typeof vi.mocked<TemplateBundleFileLoader>>;
    let mockTransformer: ReturnType<typeof vi.mocked<CalmTemplateTransformer>>;
    let loggerDebugSpy: ReturnType<typeof vi.spyOn>;
    let loggerInfoSpy: ReturnType<typeof vi.spyOn>;
    let loggerWarnSpy: ReturnType<typeof vi.spyOn>;
    const testOutputDir = './test-output';

    beforeEach(() => {
        mockFileLoader = {
            getConfig: vi.fn(),
            getTemplateFiles: vi.fn(),
        } as unknown as ReturnType<typeof vi.mocked<TemplateBundleFileLoader>>;

        mockTransformer = {
            registerTemplateHelpers: vi.fn().mockReturnValue({}),
            getTransformedModel: vi.fn(),
        } as unknown as ReturnType<typeof vi.mocked<CalmTemplateTransformer>>;

        loggerDebugSpy = vi.spyOn(TemplateEngine['logger'], 'debug').mockImplementation(vi.fn());
        loggerInfoSpy = vi.spyOn(TemplateEngine['logger'], 'info').mockImplementation(vi.fn());
        loggerWarnSpy = vi.spyOn(TemplateEngine['logger'], 'warn').mockImplementation(vi.fn());

        // Mock TemplatePreprocessor to return the input unchanged by default
        vi.mocked(TemplatePreprocessor.preprocessTemplate).mockImplementation((input: string) => input);

        // Mock TemplatePathExtractor
        vi.mocked(TemplatePathExtractor.convertFromDotNotation).mockReturnValue([]);
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
        engine.generate({}, testOutputDir);

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
        const writeFileSyncSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => { });

        const engine = new TemplateEngine(mockFileLoader, mockTransformer);

        const userData = {
            users: [
                { id: '1', name: 'Alice' },
                { id: '2', name: 'Bob' },
            ],
        };

        engine.generate(userData, testOutputDir);

        expect(mkdirSyncSpy).toHaveBeenCalledWith(testOutputDir, { recursive: true });
        expect(mkdirSyncSpy).toHaveBeenCalledWith(path.dirname(path.join(testOutputDir, '1.txt')), { recursive: true });
        expect(mkdirSyncSpy).toHaveBeenCalledWith(path.dirname(path.join(testOutputDir, '2.txt')), { recursive: true });
        expect(writeFileSyncSpy).toHaveBeenCalledTimes(2);
        expect(writeFileSyncSpy).toHaveBeenCalledWith(path.join(testOutputDir, '1.txt'), 'User: Alice', 'utf8');
        expect(writeFileSyncSpy).toHaveBeenCalledWith(path.join(testOutputDir, '2.txt'), 'User: Bob', 'utf8');
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
        const writeFileSyncSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => { });

        const engine = new TemplateEngine(mockFileLoader, mockTransformer);

        const testData = { data: { id: '123', name: 'Alice' } };

        engine.generate(testData, testOutputDir);

        expect(mkdirSyncSpy).toHaveBeenCalledWith(testOutputDir, { recursive: true });
        expect(mkdirSyncSpy).toHaveBeenCalledWith(path.dirname(path.join(testOutputDir, 'output.txt')), { recursive: true });
        expect(writeFileSyncSpy).toHaveBeenCalledTimes(1);
        expect(writeFileSyncSpy).toHaveBeenCalledWith(path.join(testOutputDir, 'output.txt'), 'User: Alice', 'utf8');
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
        engine.generate({ data: { name: 'Alice' } }, testOutputDir);

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
        engine.generate({ data: { id: '1', name: 'Alice' } }, testOutputDir);

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
        engine.generate({ data: { id: '1', name: 'Alice' } }, testOutputDir);

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
        engine.generate({ data: { name: 'Alice' } }, testOutputDir);

        expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('✅ Registering partial template: header.hbs'));
    });

    describe('template preprocessing', () => {
        it('should preprocess templates before compilation', () => {
            const templateConfig: IndexFile = {
                name: 'Test Template',
                transformer: 'mock-transformer',
                templates: [{ template: 'main.hbs', from: 'data', output: 'output.txt', 'output-type': 'single' }],
            };

            const originalTemplate = 'User: {{name}}';
            const preprocessedTemplate = 'User: {{name}} - Preprocessed';

            const templateFiles = {
                'main.hbs': originalTemplate,
            };

            mockFileLoader.getConfig.mockReturnValue(templateConfig);
            mockFileLoader.getTemplateFiles.mockReturnValue(templateFiles);

            vi.mocked(TemplatePreprocessor.preprocessTemplate).mockReturnValue(preprocessedTemplate);

            new TemplateEngine(mockFileLoader, mockTransformer);

            expect(TemplatePreprocessor.preprocessTemplate).toHaveBeenCalledWith(originalTemplate);
            expect(loggerDebugSpy).toHaveBeenCalledWith(preprocessedTemplate);
        });
    });

    describe('convertFromDotNotation helper', () => {
        it('should register convertFromDotNotation helper successfully', () => {
            const templateConfig: IndexFile = {
                name: 'Test Template',
                transformer: 'mock-transformer',
                templates: [{ template: 'main.hbs', from: 'data', output: 'output.txt', 'output-type': 'single' }],
            };

            const templateFiles = {
                'main.hbs': 'User: {{convertFromDotNotation this "user.name"}}',
            };

            mockFileLoader.getConfig.mockReturnValue(templateConfig);
            mockFileLoader.getTemplateFiles.mockReturnValue(templateFiles);

            vi.mocked(TemplatePreprocessor.preprocessTemplate).mockReturnValue(templateFiles['main.hbs']);
            vi.mocked(TemplatePathExtractor.convertFromDotNotation).mockReturnValue(['John Doe']);

            const engine = new TemplateEngine(mockFileLoader, mockTransformer);

            // Test the helper was registered by generating output
            const testData = { data: { id: 'test-id', user: { name: 'John Doe' } } };
            engine.generate(testData, './test-output');

            expect(TemplatePathExtractor.convertFromDotNotation).toHaveBeenCalledWith(
                { id: 'test-id', user: { name: 'John Doe' } },
                'user.name',
                {}
            );
        });

        it('should handle convertFromDotNotation helper errors gracefully', () => {
            const templateConfig: IndexFile = {
                name: 'Test Template',
                transformer: 'mock-transformer',
                templates: [{ template: 'main.hbs', from: 'data', output: 'output.txt', 'output-type': 'single' }],
            };

            const templateFiles = {
                'main.hbs': 'User: {{convertFromDotNotation this "invalid.path"}}',
            };

            mockFileLoader.getConfig.mockReturnValue(templateConfig);
            mockFileLoader.getTemplateFiles.mockReturnValue(templateFiles);

            vi.mocked(TemplatePreprocessor.preprocessTemplate).mockReturnValue(templateFiles['main.hbs']);
            vi.mocked(TemplatePathExtractor.convertFromDotNotation).mockImplementation(() => {
                throw new Error('Invalid path');
            });

            const engine = new TemplateEngine(mockFileLoader, mockTransformer);
            const testData = { data: { id: 'test-id' } };
            engine.generate(testData, './test-output');

            expect(loggerWarnSpy).toHaveBeenCalledWith(
                'Failed to convert from DotNotation path "invalid.path": Invalid path'
            );
        });

        it('should pass options hash to convertFromDotNotation', () => {
            const templateConfig: IndexFile = {
                name: 'Test Template',
                transformer: 'mock-transformer',
                templates: [{ template: 'main.hbs', from: 'data', output: 'output.txt', 'output-type': 'single' }],
            };

            const templateFiles = {
                'main.hbs': 'User: {{convertFromDotNotation this "user.name" option1="value1"}}',
            };

            mockFileLoader.getConfig.mockReturnValue(templateConfig);
            mockFileLoader.getTemplateFiles.mockReturnValue(templateFiles);

            vi.mocked(TemplatePreprocessor.preprocessTemplate).mockReturnValue(templateFiles['main.hbs']);
            vi.mocked(TemplatePathExtractor.convertFromDotNotation).mockReturnValue(['John Doe']);

            const engine = new TemplateEngine(mockFileLoader, mockTransformer);
            const testData = { data: { id: 'test-id', user: { name: 'John Doe' } } };
            engine.generate(testData, './test-output');

            expect(TemplatePathExtractor.convertFromDotNotation).toHaveBeenCalledWith(
                { id: 'test-id', user: { name: 'John Doe' } },
                'user.name',
                { option1: 'value1' }
            );
        });
    });
});
