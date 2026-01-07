import fs from 'fs';
import path from 'path';
import { TemplateEntry, OutputStrategy, OutputContext } from '../types.js';
import { Logger } from '../../logger.js';
import { TemplateEngine } from '../template-engine.js';
import { injectFrontMatter } from '../front-matter.js';

export abstract class AbstractOutputStrategy implements OutputStrategy {
    constructor(protected engine: TemplateEngine) {}

    abstract process(entry: TemplateEntry, context: OutputContext, logger: Logger): void;

    protected shouldInjectFrontMatter(entry: TemplateEntry): boolean {
        return entry['front-matter']?.inject ??
            (entry.output.endsWith('.md') || entry.output.endsWith('.mdx'));
    }

    protected resolvePath(data: Record<string, unknown>, dotPath: string): unknown {
        return dotPath.split('.').reduce((obj, key) => (obj as Record<string, unknown>)?.[key], data);
    }

    protected writeFile(outputPath: string, content: string, logger: Logger, logPrefix: string): void {
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, content, 'utf8');
        logger.info(`${logPrefix} ${outputPath}`);
    }

    protected applyFrontMatter(
        content: string,
        outputPath: string,
        context: OutputContext,
        frontMatterConfig: TemplateEntry['front-matter'],
        shouldInject: boolean,
        itemId?: string
    ): string {
        if (!shouldInject || !context.scaffoldPaths) {
            return content;
        }
        return injectFrontMatter(content, outputPath, {
            ...context.scaffoldPaths,
            variables: frontMatterConfig?.variables,
            itemId
        });
    }

    protected buildOutputPath(outputDir: string, filename: string): string {
        return path.join(outputDir, filename);
    }
}

