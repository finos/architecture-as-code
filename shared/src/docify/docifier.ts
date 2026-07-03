import { TemplateProcessingMode, TemplateProcessor } from '../template/template-processor.js';
import { readUrlMappingFile } from '../template/url-mapping.js';
import { initLogger } from '../logger.js';
import { launchBrowser, LaunchedBrowser } from './diagram-rendering/browser-launch.js';
import { BrowserOverrideError } from './diagram-rendering/errors.js';
import { MermaidBrowserRenderer } from './diagram-rendering/mermaid-browser-renderer.js';
import { processDiagramsInDirectory, processDiagramsInFile, formatDiagramSummary, MARKDOWN_FILE_REGEX } from './diagram-rendering/markdown-diagram-processor.js';

export type DocifyMode = 'SAD' | 'WEBSITE' | 'USER_PROVIDED' | 'ANTS';

export type DiagramExportFormat = 'svg' | 'png';

export class Docifier {
    private static readonly TEMPLATE_BUNDLE_PATHS: Record<DocifyMode, string> = {
        SAD: __dirname + '/template-bundles/sad',
        WEBSITE: __dirname + '/template-bundles/docusaurus',
        USER_PROVIDED: __dirname + '/template-bundles/null-pattern',
        ANTS: __dirname + '/template-bundles/ants'
    };

    private templateProcessor: TemplateProcessor;
    private outputPath: string;
    private exportDiagrams?: DiagramExportFormat;
    private browserPath?: string;
    private renderTimeoutMs?: number;

    constructor(
        mode: DocifyMode,
        inputPath: string,
        outputPath: string,
        urlMappingPath?: string,
        templateProcessingMode: TemplateProcessingMode = 'bundle',
        templatePath?: string,
        clearOutputDirectory: boolean = false,
        scaffoldOnly: boolean = false,
        exportDiagrams?: DiagramExportFormat,
        browserPath?: string,
        renderTimeoutMs?: number
    ) {
        if (mode === 'SAD') {
            throw new Error('Mode "SAD" is not supported.');
        }

        if (mode === 'USER_PROVIDED' && !templatePath) {
            throw new Error('USER_PROVIDED mode requires an explicit templatePath.');
        }

        const finalTemplatePath =
            templatePath ?? Docifier.TEMPLATE_BUNDLE_PATHS[mode];

        const urlToLocalPathMapping = readUrlMappingFile(urlMappingPath);

        this.outputPath = outputPath;
        this.exportDiagrams = exportDiagrams;
        this.browserPath = browserPath;
        this.renderTimeoutMs = renderTimeoutMs;

        this.templateProcessor = new TemplateProcessor(
            inputPath,
            finalTemplatePath,
            outputPath,
            urlToLocalPathMapping,
            templateProcessingMode,
            true,
            clearOutputDirectory,
            scaffoldOnly,
            urlMappingPath
        );
    }

    public async docify(): Promise<void> {
        await this.templateProcessor.processTemplate();
        if (this.exportDiagrams) {
            await this.renderDiagrams();
        }
    }

    private async renderDiagrams(): Promise<void> {
        const logger = initLogger(process.env.DEBUG === 'true', 'docify-diagram-export');
        const format = this.exportDiagrams!;
        const startTime = Date.now();

        logger.info(`ℹ️ --export-diagrams ${format}: rendering mermaid diagrams via a local browser. ` +
            'This adds processing time (browser startup plus per-diagram rendering).');

        let launched: LaunchedBrowser;
        try {
            launched = await launchBrowser({ browserPathOverride: this.browserPath });
        } catch (err) {
            if (err instanceof BrowserOverrideError) {
                throw err;
            }
            logger.warn(`⚠️ ${(err as Error).message}`);
            return;
        }

        const renderer = new MermaidBrowserRenderer({
            browser: launched.browser,
            format,
            renderTimeoutMs: this.renderTimeoutMs,
            logger
        });
        try {
            await renderer.start();
            // --output may point at a single .md/.mdx file (e.g. --template/--output <file>.md)
            // rather than a directory - process just that file in that case.
            const summary = MARKDOWN_FILE_REGEX.test(this.outputPath)
                ? await processDiagramsInFile(this.outputPath, renderer, logger)
                : await processDiagramsInDirectory(this.outputPath, renderer, logger);
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            logger.info(formatDiagramSummary(summary, format, launched.displayName, elapsed));
        } catch (err) {
            logger.warn(`⚠️ Diagram export failed: ${(err as Error).message}. Markdown output is unchanged.`);
        } finally {
            await renderer.dispose();
        }
    }
}
