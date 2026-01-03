import { TemplateEntry, OutputContext } from '../types.js';
import { Logger } from '../../logger.js';
import { TemplateEngine } from '../template-engine.js';
import { AbstractOutputStrategy } from './abstract-output-strategy.js';
import { TemplatePreprocessor } from '../template-preprocessor.js';

export class RepeatedStrategy extends AbstractOutputStrategy {
    constructor(engine: TemplateEngine) {
        super(engine);
    }

    process(entry: TemplateEntry, context: OutputContext, logger: Logger): void {
        const data = context.data as Record<string, unknown>;
        const dataSource = this.resolvePath(data, entry.from);

        if (!Array.isArray(dataSource)) {
            logger.warn(`⚠️ Expected array for repeated output, but found non-array for ${entry.template}`);
            return;
        }

        const idKey = entry['id-key'] || 'unique-id';

        if (context.scaffoldOnly) {
            this.scaffoldAll(entry, context, dataSource, idKey, logger);
        } else {
            this.renderAll(entry, context, data, dataSource, idKey, logger);
        }
    }

    private scaffoldAll(
        entry: TemplateEntry,
        context: OutputContext,
        dataSource: unknown[],
        idKey: string,
        logger: Logger
    ): void {
        for (const instance of dataSource) {
            const itemId = this.getItemId(instance, idKey);
            const filename = this.substituteOutputPath(entry.output, instance as Record<string, unknown>, itemId);
            const outputPath = this.buildOutputPath(context.outputDir, filename);

            const rawContent = this.engine.getRawTemplate(entry.template);
            if (rawContent) {
                const finalContent = this.applyFrontMatter(
                    rawContent, outputPath, context,
                    entry['front-matter'], this.shouldInjectFrontMatter(entry), itemId
                );
                this.writeFile(outputPath, finalContent, logger, '📋 Scaffolded:');
            }
        }
    }

    private renderAll(
        entry: TemplateEntry,
        context: OutputContext,
        data: Record<string, unknown>,
        dataSource: unknown[],
        idKey: string,
        logger: Logger
    ): void {
        const compiledTemplate = this.engine.getCompiledTemplate(entry.template);
        if (!compiledTemplate) {
            logger.warn(`⚠️ Skipping unknown template: ${entry.template}`);
            return;
        }

        const fullDocument = data.document || data;
        const rawTemplate = this.engine.getRawTemplate(entry.template);
        const frontMatterVariables = entry['front-matter']?.variables;
        const idType = frontMatterVariables ? Object.keys(frontMatterVariables)[0] : undefined;

        for (const instance of dataSource) {
            const itemId = this.getItemId(instance, idKey);

            const templateContext: Record<string, unknown> = {
                ...(fullDocument as Record<string, unknown>),
                _root: data,
                _architecture: fullDocument
            };

            if (idType) {
                templateContext[idType] = itemId;
            }

            const filename = this.substituteOutputPath(entry.output, instance as Record<string, unknown>, itemId);
            const outputPath = this.buildOutputPath(context.outputDir, filename);

            let activeTemplate = compiledTemplate;
            if (rawTemplate && idType) {
                const variablePattern = new RegExp(`\\{\\{${idType}\\}\\}`, 'g');
                const replacedTemplate = rawTemplate.replace(variablePattern, itemId);
                const preprocessed = TemplatePreprocessor.preprocessTemplate(replacedTemplate);
                activeTemplate = this.engine.compileTemplate(preprocessed);
            }

            let generatedContent = activeTemplate(templateContext);
            generatedContent = this.applyFrontMatter(
                generatedContent, outputPath, context,
                entry['front-matter'], this.shouldInjectFrontMatter(entry), itemId
            );

            this.writeFile(outputPath, generatedContent, logger, '✅ Generated:');
        }
    }

    private getItemId(instance: unknown, idKey: string): string {
        const record = instance as Record<string, unknown>;
        return record[idKey] as string || record.id as string || 'unknown';
    }

    private substituteOutputPath(output: string, instance: Record<string, unknown>, itemId: string): string {
        return output
            .replace(/\{\{id\}\}/g, instance.id as string || itemId)
            .replace(/\{\{unique-id\}\}/g, itemId);
    }
}

