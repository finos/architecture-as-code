import { TemplateProcessor } from '../template/template-processor.js';

export type DocifyMode = 'SAD' | 'WEBSITE';

export class Docifier {
    private static readonly TEMPLATE_BUNDLE_PATHS: Record<DocifyMode, string> = {
        SAD: __dirname + '/template-bundles/sad',
        WEBSITE: __dirname + '/template-bundles/docusaurus',
    };

    private templateProcessor: TemplateProcessor;

    constructor(mode: DocifyMode, inputPath: string, outputPath: string, urlToLocalPathMapping: Map<string, string>) {
        if (mode === 'SAD') {
            throw new Error('Mode "SAD" is not supported.');
        }

        const templateBundlePath = Docifier.TEMPLATE_BUNDLE_PATHS[mode];

        if (!templateBundlePath) {
            throw new Error(`Invalid mode: ${mode}`);
        }

        this.templateProcessor = new TemplateProcessor(inputPath, templateBundlePath, outputPath, urlToLocalPathMapping);
    }

    public async docify(): Promise<void> {
        await this.templateProcessor.processTemplate();
    }
}
