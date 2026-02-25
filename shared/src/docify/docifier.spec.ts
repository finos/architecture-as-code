import { Docifier } from './docifier';
import { TemplateProcessor } from '../template/template-processor';
import { Mock } from 'vitest';
import * as urlMapping from '../template/url-mapping';

vi.mock('../template/template-processor');
vi.mock('../template/url-mapping');

const MockedTemplateProcessor: Mock = vi.mocked(TemplateProcessor);

describe('Docifier', () => {
    const inputPath = 'some/input/path';
    const outputPath = 'some/output/path';
    const urlMappingPath = 'some/mapping/path.json';
    const mockUrlMap = new Map<string, string>();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(urlMapping.readUrlMappingFile).mockReturnValue(mockUrlMap);
    });

    it('should throw an error when mode is "SAD"', () => {
        expect(() => {
            new Docifier('SAD', inputPath, outputPath);
        }).toThrowError('Mode "SAD" is not supported.');
    });

    it('should instantiate TemplateProcessor for mode "WEBSITE" and call processTemplate', async () => {
        const processTemplateMock = vi.fn().mockResolvedValue(undefined);
        MockedTemplateProcessor.mockImplementationOnce(() => ({
            processTemplate: processTemplateMock,
        }));

        const docifier = new Docifier('WEBSITE', inputPath, outputPath);
        await docifier.docify();

        expect(MockedTemplateProcessor).toHaveBeenCalledWith(
            inputPath,
            expect.stringContaining('template-bundles/docusaurus'),
            outputPath,
            mockUrlMap,
            'bundle',
            true,
            false,
            false,
            undefined
        );
        expect(processTemplateMock).toHaveBeenCalled();
    });

    it('should pass clear-output-directory through to template processor', async () => {
        const processTemplateMock = vi.fn().mockResolvedValue(undefined);
        MockedTemplateProcessor.mockImplementationOnce(() => ({
            processTemplate: processTemplateMock,
        }));

        const docifier = new Docifier('WEBSITE', inputPath, outputPath, urlMappingPath, 'bundle', undefined, true);
        await docifier.docify();

        expect(MockedTemplateProcessor).toHaveBeenCalledWith(
            inputPath,
            expect.stringContaining('template-bundles/docusaurus'),
            outputPath,
            mockUrlMap,
            'bundle',
            true,
            true,
            false,
            urlMappingPath
        );
        expect(processTemplateMock).toHaveBeenCalled();
    });

    it('should throw if USER_PROVIDED mode is used without templatePath', () => {
        expect(() => {
            new Docifier('USER_PROVIDED', inputPath, outputPath);
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
            undefined,
            'template-directory',
            customTemplatePath
        );

        await docifier.docify();

        expect(MockedTemplateProcessor).toHaveBeenCalledWith(
            inputPath,
            customTemplatePath,
            outputPath,
            mockUrlMap,
            'template-directory',
            true,
            false,
            false,
            undefined
        );

        expect(processTemplateMock).toHaveBeenCalled();
    });

    it('should use fallback path from TEMPLATE_BUNDLE_PATHS if templatePath not provided', async () => {
        const processTemplateMock = vi.fn().mockResolvedValue(undefined);
        MockedTemplateProcessor.mockImplementationOnce(() => ({
            processTemplate: processTemplateMock,
        }));

        const docifier = new Docifier('WEBSITE', inputPath, outputPath);
        await docifier.docify();

        const [[calledInput, calledTemplatePath]] = MockedTemplateProcessor.mock.calls;

        expect(calledInput).toBe(inputPath);
        expect(calledTemplatePath).toMatch(/template-bundles\/docusaurus/);
    });

    describe('widget engine support', () => {
        it('should enable widget engine for WEBSITE mode', async () => {
            const processTemplateMock = vi.fn().mockResolvedValue(undefined);
            MockedTemplateProcessor.mockImplementation(() => ({
                processTemplate: processTemplateMock,
            }));

            const docifierWebsite = new Docifier('WEBSITE', inputPath, outputPath);
            await docifierWebsite.docify();

            expect(MockedTemplateProcessor).toHaveBeenCalledWith(
                inputPath,
                expect.stringContaining('template-bundles/docusaurus'),
                outputPath,
                mockUrlMap,
                'bundle',
                true,
                false,
                false,
                undefined
            );
        });

        it('should enable widget engine for USER_PROVIDED mode', async () => {
            const processTemplateMock = vi.fn().mockResolvedValue(undefined);
            MockedTemplateProcessor.mockImplementation(() => ({
                processTemplate: processTemplateMock,
            }));

            const customTemplatePath = '/custom/template/path';
            const docifierUserProvided = new Docifier('USER_PROVIDED', inputPath, outputPath, undefined, 'bundle', customTemplatePath);
            await docifierUserProvided.docify();

            expect(MockedTemplateProcessor).toHaveBeenCalledWith(
                inputPath,
                customTemplatePath,
                outputPath,
                mockUrlMap,
                'bundle',
                true,
                false,
                false,
                undefined
            );
        });
    });

    describe('WEBSITE mode', () => {
        it('should use docusaurus bundle path', async () => {
            const processTemplateMock = vi.fn().mockResolvedValue(undefined);
            MockedTemplateProcessor.mockImplementationOnce(() => ({
                processTemplate: processTemplateMock,
            }));

            const docifier = new Docifier('WEBSITE', inputPath, outputPath);
            await docifier.docify();

            const [[, calledTemplatePath]] = MockedTemplateProcessor.mock.calls;
            expect(calledTemplatePath).toMatch(/template-bundles\/docusaurus/);
        });

        it('should pass through all parameters correctly', async () => {
            const processTemplateMock = vi.fn().mockResolvedValue(undefined);
            MockedTemplateProcessor.mockImplementationOnce(() => ({
                processTemplate: processTemplateMock,
            }));

            const docifier = new Docifier('WEBSITE', inputPath, outputPath, urlMappingPath, 'bundle', undefined, true);
            await docifier.docify();

            expect(MockedTemplateProcessor).toHaveBeenCalledWith(
                inputPath,
                expect.stringContaining('template-bundles/docusaurus'),
                outputPath,
                mockUrlMap,
                'bundle',
                true,
                true,
                false,
                urlMappingPath
            );
        });
    });
});

