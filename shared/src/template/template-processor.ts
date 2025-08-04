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
import { initLogger } from '../logger.js';
import {CompositeReferenceResolver, MappedReferenceResolver} from '../resolver/calm-reference-resolver.js';
import {pathToFileURL} from 'node:url';
import TemplateDefaultTransformer from './template-default-transformer';
import {CalmCore} from '../model/core';
import {DereferencingVisitor} from '../model-visitor/dereference-visitor';

export type TemplateProcessingMode = 'template' | 'template-directory' | 'bundle';

export class TemplateProcessor {
    private readonly inputPath: string;
    private readonly templateBundlePath: string;
    private readonly outputPath: string;
    private readonly urlToLocalPathMapping:Map<string, string>;
    private readonly mode: TemplateProcessingMode;
    private static logger = initLogger(process.env.DEBUG === 'true', TemplateProcessor.name);

    constructor(inputPath: string, templateBundlePath: string, outputPath: string, urlToLocalPathMapping:Map<string,string>, mode: TemplateProcessingMode = 'bundle') {
        this.inputPath = inputPath;
        this.templateBundlePath = templateBundlePath;
        this.outputPath = outputPath;
        this.urlToLocalPathMapping = urlToLocalPathMapping;
        this.mode = mode;
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

        try {
            this.cleanOutputDirectory(resolvedOutputPath);

            const calmJson = this.readInputFile(resolvedInputPath);

            this.validateConfig(config);


            const mappedResolver = new MappedReferenceResolver(this.urlToLocalPathMapping, new CompositeReferenceResolver());
            const transformer = await this.loadTransformer(config.transformer, resolvedBundlePath);
            const coreModel = CalmCore.fromSchema(JSON.parse(calmJson));
            const dereference = new DereferencingVisitor(mappedResolver);
            await dereference.visit(coreModel);
            const transformedModel = transformer.getTransformedModel(coreModel);
            const engine = new TemplateEngine(loader, transformer);
            engine.generate(transformedModel, resolvedOutputPath);

            logger.info('\n✅ Template Generation Completed!');
        } catch (error) {
            logger.error(`❌ Error generating template: ${error.message}`);
            throw new Error(`❌ Error generating template: ${error.message}`);
        }
    }

    private cleanOutputDirectory(outputPath: string): void {
        const logger = TemplateProcessor.logger;
        if (fs.existsSync(outputPath)) {
            logger.info('🗑️ Cleaning up previous generation...');
            fs.rmSync(outputPath, { recursive: true, force: true });
        }
        fs.mkdirSync(outputPath, { recursive: true });
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