import fs from 'fs';
import path from 'path';
import { TemplateProcessor } from './template-processor';
import { CalmTemplateTransformer, IndexFile } from './types';
import { Mock } from 'vitest';
import { WidgetEngine, WidgetRegistry } from '@finos/calm-widgets';

vi.mock('fs');
vi.mock('@finos/calm-widgets');

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
    getConfig: vi.fn().mockReturnValue(fakeConfig),
    getTemplateFiles: vi.fn().mockReturnValue(fakeTemplateFiles),
};

vi.mock('./template-bundle-file-loader', () => ({
    TemplateBundleFileLoader: vi.fn().mockImplementation(() => mockTemplateLoader),
    SelfProvidedTemplateLoader: vi.fn().mockImplementation(() => mockTemplateLoader),
    SelfProvidedDirectoryTemplateLoader: vi.fn().mockImplementation(() => mockTemplateLoader)
}));

const mockTemplateEngine = {
    generate: vi.fn()
};

vi.mock('./template-engine', () => ({
    TemplateEngine: vi.fn().mockImplementation(() => mockTemplateEngine)
}));

const mockDereferencer = {
    dereferenceCalmDoc: vi.fn().mockResolvedValue('{"some": "dereferencedData"}')
};

vi.mock('./template-calm-file-dereferencer', () => ({
    TemplateCalmFileDereferencer: vi.fn().mockImplementation(() => mockDereferencer),
    FileReferenceResolver: vi.fn()
}));

const mappedResolverSpy = vi.fn();
vi.mock('../resolver/calm-reference-resolver', async () => {
    return {
        MappedReferenceResolver: vi.fn().mockImplementation((map, _resolver) => {
            mappedResolverSpy(map);
            return {}; // stub implementation
        }),
        CompositeReferenceResolver: vi.fn()
    };
});

const dereferenceVisitMock = vi.fn();
vi.mock('../model-visitor/dereference-visitor', async () => {
    return {
        DereferencingVisitor: vi.fn().mockImplementation(() => ({
            visit: dereferenceVisitMock
        }))
    };
});

describe('TemplateProcessor', () => {
    let mockTransformer: ReturnType<typeof vi.mocked<CalmTemplateTransformer>>;
    let loggerInfoSpy: ReturnType<typeof vi.spyOn>;
    let loggerWarnSpy: ReturnType<typeof vi.spyOn>;
    let loggerErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        // Reset all mocks before each test to ensure call counts are correct.
        vi.clearAllMocks();

        mockTransformer = {
            registerTemplateHelpers: vi.fn().mockReturnValue({}),
            getTransformedModel: vi.fn().mockReturnValue({ transformed: true }),
        } as unknown as ReturnType<typeof vi.mocked<CalmTemplateTransformer>>;

        loggerInfoSpy = vi.spyOn(TemplateProcessor['logger'], 'info').mockImplementation(vi.fn());
        loggerWarnSpy = vi.spyOn(TemplateProcessor['logger'], 'warn').mockImplementation(vi.fn());
        loggerErrorSpy = vi.spyOn(TemplateProcessor['logger'], 'error').mockImplementation(vi.fn());

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.spyOn(TemplateProcessor.prototype as any, 'loadTransformer').mockReturnValue(mockTransformer);

        (fs.existsSync as Mock).mockImplementation((filePath: string) => {
            return !filePath.includes('missing');
        });
        (fs.readdirSync as Mock).mockReturnValue([]);
        (fs.readFileSync as Mock).mockImplementation((filePath: string) => {
            if (filePath.includes('simple-nodes.json')) return '{"some": "data"}';
            if (filePath.includes('./input')) return '{"test": "data"}';
            // Return valid JSON for any other file reads
            return '{"mock": "data"}';
        });
        (fs.rmSync as Mock).mockImplementation(() => { });
        (fs.mkdirSync as Mock).mockImplementation(() => { });
        mockDereferencer.dereferenceCalmDoc.mockReset().mockResolvedValue('{"some": "dereferencedData"}');
        dereferenceVisitMock.mockReset().mockResolvedValue(undefined);
    });

    it('should successfully process a template', async () => {
        const processor = new TemplateProcessor('simple-nodes.json', 'bundle', 'output', new Map<string, string>());
        await processor.processTemplate();
        expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('✅ Output directory exists'));
        expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('✅ Template Generation Completed!'));
        expect(mockTemplateEngine.generate).toHaveBeenCalled();
        expect(mockTransformer.getTransformedModel).toHaveBeenCalledWith(
            expect.objectContaining({
                originalJson: expect.objectContaining({
                    some: 'data'
                })
            })
        );

    });

    it('should throw an error if the input file is missing', async () => {
        (fs.existsSync as Mock).mockImplementation((filePath: string) => {
            return !filePath.includes('simple-nodes.json');
        });
        const processor = new TemplateProcessor('simple-nodes.json', 'bundle', 'output', new Map<string, string>());
        await expect(processor.processTemplate()).rejects.toThrow('CALM model file not found: ' + path.resolve('simple-nodes.json'));
        expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('❌ CALM model file not found'));
    });

    it('should throw an error if loadTransformer fails', async () => {
        const configWithBadTransformer = {
            name: 'Test Bundle',
            templates: [],
            transformer: 'NonExistentTransformer'
        };
        mockTemplateLoader.getConfig.mockReturnValue(configWithBadTransformer);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.spyOn(TemplateProcessor.prototype as any, 'loadTransformer').mockImplementation(() => {
            throw new Error('TransformerClass is undefined.');
        });
        const processor = new TemplateProcessor('simple-nodes.json', 'bundle', 'output', new Map<string, string>());
        await expect(processor.processTemplate()).rejects.toThrow('❌ Error generating template: TransformerClass is undefined.');
        expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('❌ Error generating template: TransformerClass is undefined.'));
    });

    it('should throw an error if dereferencing the CALM doc fails (via DereferencingVisitor)', async () => {
        dereferenceVisitMock.mockRejectedValueOnce(new Error('Dereference failed'));
        const processor = new TemplateProcessor('simple-nodes.json', 'bundle', 'output', new Map<string, string>());
        await expect(processor.processTemplate()).rejects.toThrow('Dereference failed');
        expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Dereference failed'));
    });

    it('should pass the urlToLocalPathMapping to MappedReferenceResolver and use it in DereferencingVisitor', async () => {
        const mapping = new Map<string, string>([['http://example.com/file', '/local/path/file']]);
        const processor = new TemplateProcessor('simple-nodes.json', 'bundle', 'output', mapping);
        await processor.processTemplate();
        expect(mappedResolverSpy).toHaveBeenCalledWith(mapping);
    });

    it('should process using SelfProvidedTemplateLoader when mode is "template"', async () => {
        const { SelfProvidedTemplateLoader } = await vi.importMock('./template-bundle-file-loader');
        const processor = new TemplateProcessor('simple-nodes.json', 'some-template.md', 'output', new Map(), 'template');
        await processor.processTemplate();
        expect(SelfProvidedTemplateLoader).toHaveBeenCalledWith('some-template.md', 'output');
        expect(mockTemplateEngine.generate).toHaveBeenCalled();
    });

    it('should process using SelfProvidedDirectoryTemplateLoader when mode is "template-directory"', async () => {
        const { SelfProvidedDirectoryTemplateLoader } = await vi.importMock('./template-bundle-file-loader');
        const processor = new TemplateProcessor('simple-nodes.json', 'templates/', 'output', new Map(), 'template-directory');
        await processor.processTemplate();
        expect(SelfProvidedDirectoryTemplateLoader).toHaveBeenCalledWith('templates/');
        expect(mockTemplateEngine.generate).toHaveBeenCalled();
    });

    it('should fallback to TemplateBundleFileLoader in "bundle" mode', async () => {
        const { TemplateBundleFileLoader } = await vi.importMock('./template-bundle-file-loader');
        const processor = new TemplateProcessor('simple-nodes.json', 'bundle-dir', 'output', new Map(), 'bundle');
        await processor.processTemplate();
        expect(TemplateBundleFileLoader).toHaveBeenCalledWith('bundle-dir');
    });

    it('should create output directory if it does not exist', async () => {
        (fs.existsSync as Mock).mockImplementation((filePath: string) => {
            return !filePath.includes('output');
        });
        const processor = new TemplateProcessor('simple-nodes.json', 'bundle', 'output', new Map());
        await processor.processTemplate();
        expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringMatching('output$'), { recursive: true });
        expect(fs.rmSync).not.toHaveBeenCalled();
    });

    it('should not create output directory if it exists', async () => {
        (fs.existsSync as Mock).mockImplementation((_: string) => {
            return true;
        });
        (fs.readdirSync as Mock).mockReturnValue([]);
        const processor = new TemplateProcessor('simple-nodes.json', 'bundle', 'output', new Map());
        await processor.processTemplate();
        expect(fs.mkdirSync).not.toHaveBeenCalled();
        expect(fs.rmSync).not.toHaveBeenCalled();
        expect(fs.readdirSync).toHaveBeenCalledWith(expect.stringMatching('output$'));
    });

    it('should have warned about non-empty output directory if it exists and is non-empty', async () => {
        (fs.existsSync as Mock).mockImplementation((_: string) => {
            return true;
        });
        (fs.readdirSync as Mock).mockReturnValue(['existing-file.txt']);
        const processor = new TemplateProcessor('simple-nodes.json', 'bundle', 'output', new Map());
        await processor.processTemplate();
        expect(fs.mkdirSync).not.toHaveBeenCalled();
        expect(fs.rmSync).not.toHaveBeenCalled();
        expect(fs.readdirSync).toHaveBeenCalledWith(expect.stringMatching('output$'));
        expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('⚠️ Output directory is not empty.'));
    });

    it('should have cleared output directory if told to', async () => {
        (fs.existsSync as Mock).mockImplementation((_: string) => {
            return true;
        });
        const processor = new TemplateProcessor('simple-nodes.json', 'bundle', 'output', new Map(), 'bundle', false, true);
        await processor.processTemplate();
        expect(fs.rmSync).toHaveBeenCalledWith(expect.stringMatching('output$'), { recursive: true, force: true });
        expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringMatching('output$'), { recursive: true });
        expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('🗑️ Clearing output directory'));
    });

    describe('widget engine support', () => {
        it('should initialize widget engine when supportWidgetEngine is true', async () => {
            const mockWidgetEngine = {
                registerDefaultWidgets: vi.fn()
            } as unknown as WidgetEngine;

            const mockWidgetRegistry = {
                register: vi.fn(),
                getWidget: vi.fn(),
                getAllWidgets: vi.fn()
            } as unknown as WidgetRegistry;

            const { WidgetEngine, WidgetRegistry } = await import('@finos/calm-widgets');
            vi.mocked(WidgetEngine).mockImplementation(() => mockWidgetEngine);
            vi.mocked(WidgetRegistry).mockImplementation(() => mockWidgetRegistry);

            const processor = new TemplateProcessor(
                './input',
                './template',
                './output',
                new Map(),
                'bundle',
                true
            );

            await processor.processTemplate();

            expect(WidgetEngine).toHaveBeenCalledWith(expect.anything(), expect.anything());
            expect(WidgetRegistry).toHaveBeenCalledWith(expect.anything());
            expect(mockWidgetEngine.registerDefaultWidgets).toHaveBeenCalled();
        });

        it('should not initialize widget engine when supportWidgetEngine is false', async () => {
            const { WidgetEngine, WidgetRegistry } = await import('@finos/calm-widgets');

            // Clear any previous calls
            vi.clearAllMocks();

            const processor = new TemplateProcessor(
                './input',
                './template',
                './output',
                new Map(),
                'bundle',
                false
            );

            await processor.processTemplate();

            expect(WidgetEngine).not.toHaveBeenCalled();
            expect(WidgetRegistry).not.toHaveBeenCalled();
        });

        it('should default supportWidgetEngine to false when not provided', async () => {
            const { WidgetEngine, WidgetRegistry } = await import('@finos/calm-widgets');

            // Clear any previous calls
            vi.clearAllMocks();

            const processor = new TemplateProcessor(
                './input',
                './template',
                './output',
                new Map(),
                'bundle'
            );

            await processor.processTemplate();

            expect(WidgetEngine).not.toHaveBeenCalled();
            expect(WidgetRegistry).not.toHaveBeenCalled();
        });
    });
});
