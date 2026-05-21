import { runDiff, type DiffOutputFormat, initLogger } from '@finos/calm-shared';

export interface DiffCommandOptions {
    architectureAPath: string;
    architectureBPath: string;
    outputFormat: DiffOutputFormat;
    outputPath?: string;
    verbose: boolean;
}

export async function runDiffCommand(options: DiffCommandOptions): Promise<boolean> {
    const logger = initLogger(options.verbose, 'calm-diff');
    try {
        const result = await runDiff(options.architectureAPath, options.architectureBPath, {
            format: options.outputFormat,
            outputPath: options.outputPath,
            verbose: options.verbose,
        });

        if (!options.outputPath) {
            process.stdout.write(result.formatted);
            if (!result.formatted.endsWith('\n')) process.stdout.write('\n');
        }

        return result.hasChanges;
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('An error occurred while diffing architectures: ' + message);
        if (err instanceof Error && err.stack) logger.debug(err.stack);
        process.exit(1);
    }
}
