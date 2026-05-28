import { runDiff, runTimelineDiff, formatDiff, diffHasChanges, type DiffOutputFormat, type DiffDocumentType, type MomentDiff, initLogger } from '@finos/calm-shared';
import path from 'path';
import { mkdirp } from 'mkdirp';
import { writeFileSync } from 'fs';

export interface DiffCommandOptions {
    documentAPath: string;
    documentBPath: string;
    outputFormat: DiffOutputFormat;
    outputPath?: string;
    documentType?: DiffDocumentType;
    verbose: boolean;
}

export interface TimelineDiffCommandOptions {
    timelinePath: string;
    fromMomentId?: string;
    toMomentId?: string;
    outputFormat: DiffOutputFormat;
    outputPath?: string;
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

/**
 * Renders one or more {@link MomentDiff} entries for a timeline diff. In `json`
 * format it emits an array of `{ from, to, diff }` objects; in `summary` format
 * it prints each pair's formatted architecture diff under a `from -> to` header.
 */
export function formatTimelineDiffs(diffs: MomentDiff[], format: DiffOutputFormat): string {
    if (format === 'json') {
        return JSON.stringify(diffs, null, 2);
    }
    return diffs
        .map((momentDiff) => {
            const header = `${momentDiff.from} -> ${momentDiff.to}`;
            return [header, '='.repeat(header.length), formatDiff(momentDiff.diff, 'summary')].join('\n');
        })
        .join('\n\n');
}

export async function runTimelineDiffCommand(options: TimelineDiffCommandOptions): Promise<boolean> {
    const logger = initLogger(options.verbose, 'calm-diff');
    try {
        const result = await runTimelineDiff(options.timelinePath, {
            fromMomentId: options.fromMomentId,
            toMomentId: options.toMomentId,
            verbose: options.verbose,
        });

        const formatted = formatTimelineDiffs(result.diffs, options.outputFormat);

        if (options.outputPath) {
            const dir = path.dirname(path.resolve(options.outputPath));
            mkdirp.sync(dir);
            writeFileSync(options.outputPath, formatted);
            logger.info(`Wrote timeline diff to ${options.outputPath}`);
        } else {
            process.stdout.write(formatted);
            if (!formatted.endsWith('\n')) process.stdout.write('\n');
        }

        return result.diffs.some((momentDiff) => diffHasChanges(momentDiff.diff));
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('An error occurred while diffing the CALM timeline: ' + message);
        if (err instanceof Error && err.stack) logger.debug(err.stack);
        process.exit(1);
    }
}
