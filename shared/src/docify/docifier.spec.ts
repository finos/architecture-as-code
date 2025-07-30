import { Docifier } from './docifier';
import { TemplateProcessor } from '../template/template-processor';
import { Mock } from 'vitest';

vi.mock('../template/template-processor');

const MockedTemplateProcessor: Mock = vi.mocked(TemplateProcessor);

describe('Docifier', () => {
    const inputPath = 'some/input/path';
    const outputPath = 'some/output/path';
    const urlToLocalPathMapping = new Map<string, string>();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should throw an error when mode is "SAD"', () => {
        expect(() => {
            new Docifier('SAD', inputPath, outputPath, urlToLocalPathMapping);
        }).toThrowError('Mode "SAD" is not supported.');
    });

    it('should instantiate TemplateProcessor for mode "WEBSITE" and call processTemplate', async () => {
        const processTemplateMock = vi.fn().mockResolvedValue(undefined);
        MockedTemplateProcessor.mockImplementationOnce(() => ({
            processTemplate: processTemplateMock,
        }));

        const docifier = new Docifier('WEBSITE', inputPath, outputPath, urlToLocalPathMapping);
        await docifier.docify();

        expect(MockedTemplateProcessor).toHaveBeenCalledWith(
            inputPath,
            expect.stringContaining('template-bundles/docusaurus'),
            outputPath,
            urlToLocalPathMapping,
            'bundle'
        );
        expect(processTemplateMock).toHaveBeenCalled();
    });

    it('should throw if USER_PROVIDED mode is used without templatePath', () => {
        expect(() => {
            new Docifier('USER_PROVIDED', inputPath, outputPath, urlToLocalPathMapping);
        }).toThrowError('USER_PROVIDED mode requires an explicit templatePath.');
    });

    it('should use provided templatePath in USER_PROVIDED mode', async () => {
        const processTemplateMock = vi.fn().mockResolvedValue(undefined);
        MockedTemplateProcessor.mockImplementationOnce(() => ({
            processTemplate: processTemplateMock,
        }));

        const customTemplatePath = '/custom/templates/';
        const docifier = new Docifier(
            'USER_PROVIDED',
            inputPath,
            outputPath,
            urlToLocalPathMapping,
            'template-directory',
            customTemplatePath
        );

        await docifier.docify();

        expect(MockedTemplateProcessor).toHaveBeenCalledWith(
            inputPath,
            customTemplatePath,
            outputPath,
            urlToLocalPathMapping,
            'template-directory'
        );

        expect(processTemplateMock).toHaveBeenCalled();
    });

    it('should use fallback path from TEMPLATE_BUNDLE_PATHS if templatePath not provided', async () => {
        const processTemplateMock = vi.fn().mockResolvedValue(undefined);
        MockedTemplateProcessor.mockImplementationOnce(() => ({
            processTemplate: processTemplateMock,
        }));

        const docifier = new Docifier('WEBSITE', inputPath, outputPath, urlToLocalPathMapping);
        await docifier.docify();

        const [[calledInput, calledTemplatePath]] = MockedTemplateProcessor.mock.calls;

        expect(calledInput).toBe(inputPath);
        expect(calledTemplatePath).toMatch(/template-bundles\/docusaurus/);
    });
});
