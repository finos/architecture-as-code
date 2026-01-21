/* eslint-disable  @typescript-eslint/no-explicit-any */
import Handlebars from 'handlebars';
import { IndexFile, CalmTemplateTransformer, OutputStrategy, OutputContext } from './types.js';
import { ITemplateBundleLoader } from './template-bundle-file-loader.js';
import { initLogger, Logger } from '../logger.js';
import fs from 'fs';
import { TemplatePathExtractor } from './template-path-extractor.js';
import { TemplatePreprocessor } from './template-preprocessor.js';
import { CopyStrategy } from './strategies/copy-strategy.js';
import { SingleStrategy } from './strategies/single-strategy.js';
import { RepeatedStrategy } from './strategies/repeated-strategy.js';

export class TemplateEngine {
    private readonly compiledTemplates: Record<string, Handlebars.TemplateDelegate>;
    private readonly rawTemplates: Record<string, string>;
    private readonly config: IndexFile;
    private readonly strategies: Record<string, OutputStrategy>;
    private static _logger: Logger | undefined;

    private static get logger(): Logger {
        if (!this._logger) {
            this._logger = initLogger(process.env.DEBUG === 'true', TemplateEngine.name);
        }
        return this._logger;
    }

    constructor(fileLoader: ITemplateBundleLoader, transformer: CalmTemplateTransformer) {
        this.config = fileLoader.getConfig();
        this.rawTemplates = fileLoader.getTemplateFiles();
        this.compiledTemplates = this.compileAllTemplates();
        this.registerHelpers(transformer);
        this.strategies = {
            'copy': new CopyStrategy(this),
            'single': new SingleStrategy(this),
            'repeated': new RepeatedStrategy(this)
        };
    }

    public generate(
        data: any,
        outputDir: string,
        scaffoldOnly: boolean = false,
        scaffoldPaths?: { architecturePath: string; urlMappingPath?: string }
    ): void {
        const logger = TemplateEngine.logger;
        logger.info(scaffoldOnly ? '\n🔹 Starting Scaffold Generation...' : '\n🔹 Starting Template Generation...');

        this.ensureOutputDirectory(outputDir);

        const context: OutputContext = { data, outputDir, scaffoldOnly, scaffoldPaths };

        for (const entry of this.config.templates) {
            this.registerPartials(entry.partials);
            const strategy = this.strategies[entry['output-type']];
            if (strategy) {
                strategy.process(entry, context, logger);
            } else {
                logger.warn(`⚠️ Unknown output-type: ${entry['output-type']}`);
            }
        }

        logger.info('\n✅ Template Generation Completed!');
    }

    getCompiledTemplate(name: string): Handlebars.TemplateDelegate | undefined {
        return this.compiledTemplates[name];
    }

    getRawTemplate(name: string): string | undefined {
        return this.rawTemplates[name];
    }

    compileTemplate(content: string): Handlebars.TemplateDelegate {
        return Handlebars.compile(content);
    }

    private compileAllTemplates(): Record<string, Handlebars.TemplateDelegate> {
        const logger = TemplateEngine.logger;
        const compiled: Record<string, Handlebars.TemplateDelegate> = {};

        for (const [fileName, content] of Object.entries(this.rawTemplates)) {
            const preprocessed = TemplatePreprocessor.preprocessTemplate(content);
            logger.debug(preprocessed);
            compiled[fileName] = Handlebars.compile(preprocessed);
        }

        logger.info(`✅ Compiled ${Object.keys(compiled).length} Templates`);
        return compiled;
    }

    private registerHelpers(transformer: CalmTemplateTransformer): void {
        const logger = TemplateEngine.logger;
        logger.info('🔧 Registering Handlebars Helpers...');

        Handlebars.registerHelper('convertFromDotNotation', (context: unknown, path: string, options?: any) => {
            try {
                return TemplatePathExtractor.convertFromDotNotation(context, path, options?.hash || {});
            } catch (err) {
                logger.warn(`Failed to convert from DotNotation path "${path}": ${(err as Error).message}`);
                return [];
            }
        });

        const helperFunctions = transformer.registerTemplateHelpers();
        for (const [name, fn] of Object.entries(helperFunctions)) {
            Handlebars.registerHelper(name, fn);
            logger.info(`✅ Registered helper: ${name}`);
        }
    }

    private registerPartials(partials: string[] | undefined): void {
        if (!partials) return;

        const logger = TemplateEngine.logger;
        for (const partial of partials) {
            if (this.compiledTemplates[partial]) {
                logger.info(`✅ Registering partial template: ${partial}`);
                Handlebars.registerPartial(partial, this.compiledTemplates[partial]);
            } else {
                logger.warn(`⚠️ Missing partial template: ${partial}`);
            }
        }
    }

    private ensureOutputDirectory(outputDir: string): void {
        if (!fs.existsSync(outputDir)) {
            TemplateEngine.logger.info(`📂 Output directory does not exist. Creating: ${outputDir}`);
            fs.mkdirSync(outputDir, { recursive: true });
        }
    }
}

