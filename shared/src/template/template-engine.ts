/* eslint-disable  @typescript-eslint/no-explicit-any */
import Handlebars from 'handlebars';
import { IndexFile, TemplateEntry, CalmTemplateTransformer } from './types.js';
import {ITemplateBundleLoader} from './template-bundle-file-loader.js';
import { initLogger } from '../logger.js';
import fs from 'fs';
import path from 'path';


export class TemplateEngine {
    private readonly templates: Record<string, Handlebars.TemplateDelegate>;
    private readonly config: IndexFile;
    private transformer: CalmTemplateTransformer;
    private static logger = initLogger(process.env.DEBUG === 'true', TemplateEngine.name);

    constructor(fileLoader: ITemplateBundleLoader, transformer: CalmTemplateTransformer) {
        this.config = fileLoader.getConfig();
        this.transformer = transformer;
        this.templates = this.compileTemplates(fileLoader.getTemplateFiles());
        this.registerTemplateHelpers();
    }

    private compileTemplates(templateFiles: Record<string, string>): Record<string, Handlebars.TemplateDelegate> {
        const logger = TemplateEngine.logger;
        const compiledTemplates: Record<string, Handlebars.TemplateDelegate> = {};

        for (const [fileName, content] of Object.entries(templateFiles)) {
            compiledTemplates[fileName] = Handlebars.compile(content);
        }

        logger.info(`✅ Compiled ${Object.keys(compiledTemplates).length} Templates`);
        return compiledTemplates;
    }

    private registerTemplateHelpers(): void {
        const logger = TemplateEngine.logger;
        logger.info('🔧 Registering Handlebars Helpers...');

        const helperFunctions = this.transformer.registerTemplateHelpers();

        Object.entries(helperFunctions).forEach(([name, fn]) => {
            Handlebars.registerHelper(name, fn);
            logger.info(`✅ Registered helper: ${name}`);
        });
    }

    public generate(data: any, outputDir: string): void {
        const logger = TemplateEngine.logger;
        logger.info('\n🔹 Starting Template Generation...');

        if (!fs.existsSync(outputDir)) {
            logger.info(`📂 Output directory does not exist. Creating: ${outputDir}`);
            fs.mkdirSync(outputDir, { recursive: true });
        }

        for (const templateEntry of this.config.templates) {
            this.processTemplate(templateEntry, data, outputDir);
        }

        logger.info('\n✅ Template Generation Completed!');
    }

    private processTemplate(templateEntry: TemplateEntry, data: any, outputDir: string): void {
        const logger = TemplateEngine.logger;
        const { template, from, output, 'output-type': outputType, partials } = templateEntry;

        if (!this.templates[template]) {
            logger.warn(`⚠️ Skipping unknown template: ${template}`);
            return;
        }

        if (partials) {
            for (const partial of partials) {
                if (this.templates[partial]) {
                    logger.info(`✅ Registering partial template: ${partial}`);
                    Handlebars.registerPartial(partial, this.templates[partial]);
                } else {
                    logger.warn(`⚠️ Missing partial template: ${partial}`);
                }
            }
        }

        const dataSource = data[from];

        if (outputType === 'repeated') {
            if (!Array.isArray(dataSource)) {
                logger.warn(`⚠️ Expected array for repeated output, but found non-array for ${template}`);
                return;
            }

            for (const instance of dataSource) {
                const filename = output.replace('{{id}}', instance.id);//TODO: Improve output naming for use case.
                const outputPath = path.join(outputDir, filename);
                fs.mkdirSync(path.dirname(outputPath), { recursive: true });
                fs.writeFileSync(outputPath, this.templates[template](instance), 'utf8');
                logger.info(`✅ Generated: ${outputPath}`);
            }
        } else if (outputType === 'single') {
            const filename = output.replace('{{id}}', dataSource.id);//TODO: Improve output naming for use case.
            const outputPath = path.join(outputDir, filename);
            fs.mkdirSync(path.dirname(outputPath), { recursive: true });
            fs.writeFileSync(outputPath, this.templates[template](dataSource), 'utf8');
            logger.info(`✅ Generated: ${outputPath}`);
        } else {
            logger.warn(`⚠️ Unknown output-type: ${outputType}`);
        }
    }
}
