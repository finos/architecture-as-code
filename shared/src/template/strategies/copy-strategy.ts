import { TemplateEntry, OutputContext } from '../types.js';
import { Logger } from '../../logger.js';
import { TemplateEngine } from '../template-engine.js';
import { AbstractOutputStrategy } from './abstract-output-strategy.js';

export class CopyStrategy extends AbstractOutputStrategy {
    constructor(engine: TemplateEngine) {
        super(engine);
    }

    process(entry: TemplateEntry, context: OutputContext, logger: Logger): void {
        const outputPath = this.buildOutputPath(context.outputDir, entry.output);
        const rawContent = this.engine.getRawTemplate(entry.template);

        if (rawContent) {
            this.writeFile(outputPath, rawContent, logger, '📋 Copied:');
        }
    }
}

