import { runDiff, type DiffOutputFormat, type DiffDocumentType, initLogger } from '@finos/calm-shared';

export interface DiffCommandOptions {
    documentAPath: string;
    documentBPath: string;
    outputFormat: DiffOutputFormat;
    outputPath?: string;
    documentType?: DiffDocumentType;
    verbose: boolean;
}

export async function runDiffCommand(options: DiffCommandOptions): Promise<boolean> {
    const logger = initLogger(options.verbose, 'calm-diff');
    try {
        const result = await runDiff(options.documentAPath, options.documentBPath, {
            format: options.outputFormat,
            outputPath: options.outputPath,
            documentType: options.documentType,
            verbose: options.verbose,
        });

        if (!options.outputPath) {
            process.stdout.write(result.formatted);
            if (!result.formatted.endsWith('\n')) process.stdout.write('\n');
        }

        return result.hasChanges;
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('An error occurred while diffing CALM documents: ' + message);
        if (err instanceof Error && err.stack) logger.debug(err.stack);
        process.exit(1);
    }
}
