import fs from 'fs';
import path from 'path';
import { TemplateProcessor } from './template-processor';
import { CalmTemplateTransformer, IndexFile } from './types';
vi.mock('fs');

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

vi.mock('./template-bundle-file-loader', () => {
    return {
        TemplateBundleFileLoader: vi.fn().mockImplementation(() => mockTemplateLoader)
    };
});

const mockTemplateEngine = {
    generate: vi.fn()
};

vi.mock('./template-engine', () => {
    return {
        TemplateEngine: vi.fn().mockImplementation(() => mockTemplateEngine)
    };
});

const mockDereferencer = {
    dereferenceCalmDoc: vi.fn().mockResolvedValue('{"some": "dereferencedData"}')
};

vi.mock('./template-calm-file-dereferencer', () => {
    return {
        TemplateCalmFileDereferencer: vi.fn().mockImplementation(() => mockDereferencer),
        FileReferenceResolver: vi.fn()
    };
});

describe('TemplateProcessor', () => {
    let mockTransformer: vi.mocked<CalmTemplateTransformer>;
    let loggerInfoSpy: vi.SpyInstance;
    let loggerErrorSpy: vi.SpyInstance;

    beforeEach(() => {
        mockTransformer = {
            registerTemplateHelpers: vi.fn().mockReturnValue({}),
            getTransformedModel: vi.fn().mockReturnValue({ transformed: true }),
        } as unknown as vi.mocked<CalmTemplateTransformer>;

        loggerInfoSpy = vi.spyOn(TemplateProcessor['logger'], 'info').mockImplementation(vi.fn());
        loggerErrorSpy = vi.spyOn(TemplateProcessor['logger'], 'error').mockImplementation(vi.fn());

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.spyOn(TemplateProcessor.prototype as any, 'loadTransformer').mockReturnValue(mockTransformer);

        (fs.existsSync as vi.mock).mockImplementation((filePath: string) => {
            return !filePath.includes('missing');
        });
        (fs.readFileSync as vi.mock).mockImplementation((filePath: string) => {
            if (filePath.includes('simple-nodes.json')) return '{"some": "data"}';
            return '';
        });
        (fs.rmSync as vi.mock).mockImplementation(() => {});
        (fs.mkdirSync as vi.mock).mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
    });

    it('should successfully process a template', async () => {
        const processor = new TemplateProcessor('simple-nodes.json', 'bundle', 'output', new Map<string, string>());
        await processor.processTemplate();
        expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('🗑️ Cleaning up previous generation...'));
        expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('✅ Template Generation Completed!'));
        expect(mockTemplateEngine.generate).toHaveBeenCalled();
        expect(mockTransformer.getTransformedModel).toHaveBeenCalledWith('{"some": "dereferencedData"}');
    });

//     it('should throw an error if the input file is missing', async () => {
//         (fs.existsSync as vi.mock).mockImplementation((filePath: string) => {
//             return !filePath.includes('simple-nodes.json');
//         });
//         const processor = new TemplateProcessor('simple-nodes.json', 'bundle', 'output', new Map<string, string>());
//         await expect(processor.processTemplate()).rejects.toThrow('CALM model file not found: ' + path.resolve('simple-nodes.json'));
//         expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('❌ CALM model file not found'));
//     });

//     it('should throw an error if the transformer field is missing in config', async () => {
//         const configNoTransformer = {
//             name: 'Test Bundle',
//             templates: []
//         };
//         mockTemplateLoader.getConfig.mockReturnValue(configNoTransformer);
//         const processor = new TemplateProcessor('simple-nodes.json', 'bundle', 'output', new Map<string, string>());
//         await expect(processor.processTemplate()).rejects.toThrow(
//             'Missing "transformer" field in index.json. Define a transformer for this template bundle.'
//         );
//         expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('❌ Missing "transformer" field in index.json.'));
//     });

//     it('should throw an error if loadTransformer fails', async () => {
//         const configWithBadTransformer = {
//             name: 'Test Bundle',
//             templates: [],
//             transformer: 'NonExistentTransformer'
//         };
//         mockTemplateLoader.getConfig.mockReturnValue(configWithBadTransformer);

//         // eslint-disable-next-line @typescript-eslint/no-explicit-any
//         vi.spyOn(TemplateProcessor.prototype as any, 'loadTransformer').mockImplementation(() => {
//             throw new Error('TransformerClass is undefined.');
//         });
//         const processor = new TemplateProcessor('simple-nodes.json', 'bundle', 'output', new Map<string, string>());
//         await expect(processor.processTemplate()).rejects.toThrow('❌ Error generating template: TransformerClass is undefined.');
//         expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('❌ Error generating template: TransformerClass is undefined.'));
//     });

//     it('should pass the urlToLocalPathMapping to the TemplateCalmFileRefResolver', async () => {
//         const mapping = new Map<string, string>([['http://example.com/file', '/local/path/file']]);
//         const processor = new TemplateProcessor('simple-nodes.json', 'bundle', 'output', mapping);
//         await processor.processTemplate();
//         const { TemplateCalmFileDereferencer } = vi.requireMock('./template-calm-file-dereferencer');
//         expect(TemplateCalmFileDereferencer).toHaveBeenCalledWith(mapping, expect.anything());
//     });

//     it('should throw an error if dereferencing the CALM doc fails', async () => {
//         (mockDereferencer.dereferenceCalmDoc as vi.mock).mockRejectedValue(new Error('Dereference failed'));
//         const processor = new TemplateProcessor('simple-nodes.json', 'bundle', 'output', new Map<string, string>());
//         await expect(processor.processTemplate()).rejects.toThrow('Dereference failed');
//         expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Dereference failed'));
//     });
});
