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
            'bundle',
            false,
            false
        );
        expect(processTemplateMock).toHaveBeenCalled();
    });

    it('should pass clear-output-directory through to template processor', async () => {
        const processTemplateMock = vi.fn().mockResolvedValue(undefined);
        MockedTemplateProcessor.mockImplementationOnce(() => ({
            processTemplate: processTemplateMock,
        }));

        const docifier = new Docifier('WEBSITE', inputPath, outputPath, urlToLocalPathMapping, 'bundle', undefined, true);
        await docifier.docify();

        expect(MockedTemplateProcessor).toHaveBeenCalledWith(
            inputPath,
            expect.stringContaining('template-bundles/docusaurus'),
            outputPath,
            urlToLocalPathMapping,
            'bundle',
            false,
            true
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
            'template-directory',
            true,
            false
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

    describe('widget engine support', () => {
        it('should enable widget engine for all modes except WEBSITE', async () => {
            const processTemplateMock = vi.fn().mockResolvedValue(undefined);
            MockedTemplateProcessor.mockImplementation(() => ({
                processTemplate: processTemplateMock,
            }));

            // Test WEBSITE mode - should disable widget engine (supportWidgetEngine = false)
            const docifierWebsite = new Docifier('WEBSITE', inputPath, outputPath, urlToLocalPathMapping);
            await docifierWebsite.docify();

            expect(MockedTemplateProcessor).toHaveBeenCalledWith(
                inputPath,
                expect.stringContaining('template-bundles/docusaurus'),
                outputPath,
                urlToLocalPathMapping,
                'bundle',
                false, // supportWidgetEngine should be false for WEBSITE mode
                false
            );

            vi.clearAllMocks();

            // Test USER_PROVIDED mode - should enable widget engine (supportWidgetEngine = true)
            // Need to provide templatePath for USER_PROVIDED mode
            const customTemplatePath = '/custom/template/path';
            const docifierUserProvided = new Docifier('USER_PROVIDED', inputPath, outputPath, urlToLocalPathMapping, 'bundle', customTemplatePath);
            await docifierUserProvided.docify();

            expect(MockedTemplateProcessor).toHaveBeenCalledWith(
                inputPath,
                customTemplatePath,
                outputPath,
                urlToLocalPathMapping,
                'bundle',
                true, // supportWidgetEngine should be true for USER_PROVIDED mode
                false
            );
        });

        it('should include TODO comment logic for widget engine decision', async () => {
            const processTemplateMock = vi.fn().mockResolvedValue(undefined);
            MockedTemplateProcessor.mockImplementation(() => ({
                processTemplate: processTemplateMock,
            }));

            // This test verifies the logic: supportWidgetEngine = mode !== 'WEBSITE'
            const docifier = new Docifier('WEBSITE', inputPath, outputPath, urlToLocalPathMapping);
            await docifier.docify();

            // For WEBSITE mode, supportWidgetEngine should be false due to the comment:
            // "TODO: need to move docifier and graphing package to widget framework. Until then widgets will clash"
            expect(MockedTemplateProcessor).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(String),
                expect.any(String),
                expect.any(Map),
                expect.any(String),
                false, // This reflects the TODO comment about widget clashing
                false
            );
        });
    });
});
