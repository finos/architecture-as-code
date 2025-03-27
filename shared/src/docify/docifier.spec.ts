import { Docifier } from './docifier';
import { TemplateProcessor } from '../template/template-processor';

vi.mock('../template/template-processor');

const mockedTemplateProcessor = TemplateProcessor as vi.mockedClass<typeof TemplateProcessor>;

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

        mockedTemplateProcessor.mockImplementationOnce(() => ({
            processTemplate: processTemplateMock,
        }) as never);

        const docifier = new Docifier('WEBSITE', inputPath, outputPath, urlToLocalPathMapping);
        await docifier.docify();

        // Verify that TemplateProcessor was instantiated with the correct parameters.
        expect(mockedTemplateProcessor).toHaveBeenCalledWith(
            inputPath,
            expect.stringContaining('template-bundles/docusaurus'),
            outputPath,
            urlToLocalPathMapping
        );

        expect(processTemplateMock).toHaveBeenCalled();
    });
});
