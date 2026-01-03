import { TemplateEntry, OutputContext } from '../types.js';
import { Logger } from '../../logger.js';
import { TemplateEngine } from '../template-engine.js';
import { AbstractOutputStrategy } from './abstract-output-strategy.js';

export class SingleStrategy extends AbstractOutputStrategy {
    constructor(engine: TemplateEngine) {
        super(engine);
    }

    process(entry: TemplateEntry, context: OutputContext, logger: Logger): void {
        if (context.scaffoldOnly) {
            this.scaffold(entry, context, logger);
        } else {
            this.render(entry, context, logger);
        }
    }

    private scaffold(entry: TemplateEntry, context: OutputContext, logger: Logger): void {
        const outputPath = this.buildOutputPath(context.outputDir, entry.output);
        const rawContent = this.engine.getRawTemplate(entry.template);

        if (rawContent) {
            const finalContent = this.applyFrontMatter(
                rawContent, outputPath, context,
                entry['front-matter'], this.shouldInjectFrontMatter(entry)
            );
            this.writeFile(outputPath, finalContent, logger, '📋 Scaffolded:');
        }
    }

    private render(entry: TemplateEntry, context: OutputContext, logger: Logger): void {
        const compiledTemplate = this.engine.getCompiledTemplate(entry.template);
        if (!compiledTemplate) {
            logger.warn(`⚠️ Skipping unknown template: ${entry.template}`);
            return;
        }

        const data = context.data as Record<string, unknown>;
        const dataSource = this.resolvePath(data, entry.from) as Record<string, unknown> | undefined;
        const frontMatterVariables = entry['front-matter']?.variables || {};

        const templateContext: Record<string, unknown> = {
            ...(dataSource || {}),
            ...frontMatterVariables,
            _root: data,
            _architecture: data.document || data
        };

        const filename = entry.output.replace(/\{\{id\}\}/g, dataSource?.id as string || '');
        const outputPath = this.buildOutputPath(context.outputDir, filename);

        let generatedContent = compiledTemplate(templateContext);
        generatedContent = this.applyFrontMatter(
            generatedContent, outputPath, context,
            entry['front-matter'], this.shouldInjectFrontMatter(entry)
        );

        this.writeFile(outputPath, generatedContent, logger, '✅ Generated:');
    }
}

