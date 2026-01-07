import fs from 'fs';
import path from 'path';
import { register } from 'ts-node';
import 'source-map-support/register';
import { TemplateEngine } from './template-engine.js';
import { CalmTemplateTransformer, IndexFile } from './types.js';
import {
    ITemplateBundleLoader, SelfProvidedDirectoryTemplateLoader,
    SelfProvidedTemplateLoader,
    TemplateBundleFileLoader
} from './template-bundle-file-loader.js';
import { initLogger, Logger } from '../logger.js';
import { CompositeReferenceResolver, MappedReferenceResolver } from '../resolver/calm-reference-resolver.js';
import { pathToFileURL } from 'node:url';
import TemplateDefaultTransformer from './template-default-transformer';
import { CalmCore } from '@finos/calm-models/model';
import { DereferencingVisitor } from '../model-visitor/dereference-visitor';
import { WidgetEngine, WidgetRegistry } from '@finos/calm-widgets';
import Handlebars from 'handlebars';

export type TemplateProcessingMode = 'template' | 'template-directory' | 'bundle';

export class TemplateProcessor {
    private readonly inputPath: string;
    private readonly templateBundlePath: string;
    private readonly outputPath: string;
    private readonly urlToLocalPathMapping: Map<string, string>;
    private readonly mode: TemplateProcessingMode;
    private readonly supportWidgetEngine: boolean;
    private readonly clearOutputDirectory: boolean = false;
    private readonly scaffoldOnly: boolean = false;
    private readonly urlMappingPath?: string;  // Original path for scaffold front-matter

    private static _logger: Logger | undefined;

    private static get logger(): Logger {
        if (!this._logger) {
            this._logger = initLogger(process.env.DEBUG === 'true', TemplateProcessor.name);
        }
        return this._logger;
    }

    constructor(
        inputPath: string,
        templateBundlePath: string,
        outputPath: string,
        urlToLocalPathMapping: Map<string, string>,
        mode: TemplateProcessingMode = 'bundle',
        supportWidgetEngine: boolean = false,
        clearOutputDirectory: boolean = false,
        scaffoldOnly: boolean = false,
        urlMappingPath?: string
    ) {
        this.inputPath = inputPath;
        this.templateBundlePath = templateBundlePath;
        this.outputPath = outputPath;
        this.urlToLocalPathMapping = urlToLocalPathMapping;
        this.mode = mode;
        this.supportWidgetEngine = supportWidgetEngine;
        this.clearOutputDirectory = clearOutputDirectory;
        this.scaffoldOnly = scaffoldOnly;
        this.urlMappingPath = urlMappingPath;
    }

    public async processTemplate(): Promise<void> {
        const logger = TemplateProcessor.logger;

        const resolvedInputPath = path.resolve(this.inputPath);
        const resolvedBundlePath = path.resolve(this.templateBundlePath);
        const resolvedOutputPath = path.extname(this.outputPath)
            ? path.dirname(path.resolve(this.outputPath))
            : path.resolve(this.outputPath);


        let loader: ITemplateBundleLoader;

        switch (this.mode) {
        case 'template':
            logger.info('Using SelfProvidedTemplateLoader for single template file');
            loader = new SelfProvidedTemplateLoader(this.templateBundlePath, this.outputPath);
            break;
        case 'template-directory':
            logger.info('Using SelfProvidedDirectoryTemplateLoader for template directory');
            loader = new SelfProvidedDirectoryTemplateLoader(this.templateBundlePath);
            break;
        case 'bundle':
        default:
            logger.info('Using TemplateBundleFileLoader for bundle');
            loader = new TemplateBundleFileLoader(this.templateBundlePath);
            break;
        }

        const config = loader.getConfig();

        if (this.supportWidgetEngine === true) {
            //TODO: Handlebars supports local instance. Ideally to make testable we should use a local instance of Handlebars and inject dependency.
            const widgetEngine = new WidgetEngine(Handlebars, new WidgetRegistry(Handlebars));
            widgetEngine.registerDefaultWidgets();
        }

        try {
            this.createOutputDirectory(resolvedOutputPath);

            const calmJson = this.readInputFile(resolvedInputPath);

            this.validateConfig(config);


            const mappedResolver = new MappedReferenceResolver(this.urlToLocalPathMapping, new CompositeReferenceResolver());
            const transformer = await this.loadTransformer(config.transformer, resolvedBundlePath);
            const coreModel = CalmCore.fromSchema(JSON.parse(calmJson));
            const dereference = new DereferencingVisitor(mappedResolver);
            await dereference.visit(coreModel);
            const transformedModel = transformer.getTransformedModel(coreModel);
            const engine = new TemplateEngine(loader, transformer);

            // Pass scaffold paths for front-matter injection
            // Always provide paths so both scaffold and non-scaffold modes produce identical output
            const scaffoldPaths = {
                architecturePath: resolvedInputPath,
                urlMappingPath: this.urlMappingPath
            };

            engine.generate(transformedModel, resolvedOutputPath, this.scaffoldOnly, scaffoldPaths);

            if (this.scaffoldOnly) {
                logger.info('\n✅ Scaffold Generation Completed!');
            } else {
                logger.info('\n✅ Template Generation Completed!');
            }
        } catch (error) {
            logger.error(`❌ Error generating template: ${error.message}`);
            throw new Error(`❌ Error generating template: ${error.message}`);
        }
    }

    private createOutputDirectory(outputPath: string): void {
        const logger = TemplateProcessor.logger;
        if (fs.existsSync(outputPath)) {
            logger.info(`✅ Output directory exists: ${outputPath}`);
            if (this.clearOutputDirectory) {
                logger.info(`🗑️ Clearing output directory: ${outputPath}`);
                fs.rmSync(outputPath, { recursive: true, force: true });
                fs.mkdirSync(outputPath, { recursive: true });
            }
            else {
                const directoryContents = fs.readdirSync(outputPath);
                if (directoryContents && directoryContents.length > 0) {
                    logger.warn('⚠️ Output directory is not empty. Any files not overwritten will remain untouched.');
                }
            }
        }
        else {
            logger.info(`📂 Creating output directory: ${outputPath}`);
            fs.mkdirSync(outputPath, { recursive: true });
        }
    }

    private readInputFile(inputPath: string): string {
        const logger = TemplateProcessor.logger;
        if (!fs.existsSync(inputPath)) {
            logger.error(`❌ CALM model file not found: ${inputPath}`);
            throw new Error(`CALM model file not found: ${inputPath}`);
        }
        return fs.readFileSync(inputPath, 'utf8');
    }

    private validateConfig(config: IndexFile): void {
        const logger = TemplateProcessor.logger;

        if (config.transformer) {
            const tsPath = path.join(this.templateBundlePath, `${config.transformer}.ts`);
            const jsPath = path.join(this.templateBundlePath, `${config.transformer}.js`);

            const tsExists = fs.existsSync(tsPath);
            const jsExists = fs.existsSync(jsPath);

            if (!tsExists && !jsExists) {
                const errorMsg = `Transformer "${config.transformer}" specified in index.json but not found as .ts or .js in ${this.templateBundlePath}`;
                logger.error(`❌ ${errorMsg}`);
                throw new Error(`❌ ${errorMsg}`);
            }
        } else {
            logger.info('ℹ️ No transformer specified in index.json. Will use TemplateDefaultTransformer.');
        }
    }


    private async loadTransformer(transformerName: string, bundlePath: string): Promise<CalmTemplateTransformer> {
        const logger = TemplateProcessor.logger;

        if (!transformerName) {
            logger.info('🔁 No transformer provided. Using TemplateDefaultTransformer.');
            return new TemplateDefaultTransformer();
        }

        const transformerFileTs = path.join(bundlePath, `${transformerName}.ts`);
        const transformerFileJs = path.join(bundlePath, `${transformerName}.js`);
        let transformerFilePath: string | null = null;

        if (fs.existsSync(transformerFileTs)) {
            logger.info(`🔍 Loading transformer as TypeScript: ${transformerFileTs}`);
            register({
                transpileOnly: true,
                compilerOptions: {
                    target: 'es2021',
                    module: 'esnext',
                    moduleResolution: 'node',
                    esModuleInterop: true,
                    sourceMap: true,
                    inlineSourceMap: true,
                    inlineSources: true,
                },
            });
            transformerFilePath = transformerFileTs;
        } else if (fs.existsSync(transformerFileJs)) {
            logger.info(`🔍 Loading transformer as JavaScript: ${transformerFileJs}`);
            transformerFilePath = transformerFileJs;
        } else {
            logger.error(`❌ Transformer file not found: ${transformerFileTs} or ${transformerFileJs}`);
            throw new Error(`❌ Transformer file not found: ${transformerFileTs} or ${transformerFileJs}`);
        }

        try {
            const url = pathToFileURL(transformerFilePath).href;
            const mod = await import(/* @vite-ignore */ url);
            const TransformerClass = mod.default;
            if (typeof TransformerClass !== 'function') {
                throw new Error('❌ TransformerClass is not a constructor. Did you forget to export default?');
            }
            return new TransformerClass();
        } catch (error) {
            logger.error(`❌ Error loading transformer: ${error.message}`);
            throw new Error(`❌ Error loading transformer: ${error.message}`);
        }
    }
}