import * as fs from 'node:fs';
import * as path from 'node:path';
import { mkdirp } from 'mkdirp';
import type { ArchitectureResolver, TimelineInput } from '@finos/calm-models/diff';
import { initLogger } from '../../logger.js';
import {
    diffDocuments,
    diffTimeline,
    type DiffDocumentType,
    type DiffOutputFormat,
    type DiffRunResult,
    type TimelineDiffRunOptions,
    type TimelineDiffRunResult,
} from './diff-core.js';

export * from './diff-core.js';

export interface DiffRunOptions {
    format?: DiffOutputFormat;
    outputPath?: string;
    verbose?: boolean;
    /** Override automatic architecture/pattern detection. */
    documentType?: DiffDocumentType;
}

function readDocument(filePath: string): Record<string, unknown> {
    const resolved = path.resolve(filePath);
    const raw = fs.readFileSync(resolved, 'utf-8');
    return JSON.parse(raw) as Record<string, unknown>;
}

export async function runDiff(docAPath: string, docBPath: string, options: DiffRunOptions = {}): Promise<DiffRunResult> {
    const logger = initLogger(!!options.verbose, 'calm-diff');
    logger.info(`Comparing ${docAPath} -> ${docBPath}`);
    const result = diffDocuments(readDocument(docAPath), readDocument(docBPath), {
        format: options.format,
        verbose: options.verbose,
        documentType: options.documentType,
        labels: [docAPath, docBPath],
    });
    if (options.outputPath) {
        const dir = path.dirname(path.resolve(options.outputPath));
        mkdirp.sync(dir);
        fs.writeFileSync(options.outputPath, result.formatted);
        logger.info(`Wrote diff to ${options.outputPath}`);
    }
    return result;
}

/**
 * Builds a filesystem-backed {@link ArchitectureResolver} that resolves a
 * moment's `detailed-architecture` string reference relative to the directory
 * of the timeline document being diffed.
 */
export function createFileSystemArchitectureResolver(baseDir: string): ArchitectureResolver {
    return async (reference: string) => {
        const resolved = path.isAbsolute(reference) ? reference : path.resolve(baseDir, reference);
        const raw = await fs.promises.readFile(resolved, 'utf-8');
        return JSON.parse(raw) as Record<string, unknown>;
    };
}

/**
 * Diffs a CALM timeline document on disk. Moment `detailed-architecture`
 * references are resolved relative to the timeline file's directory. Diffs all
 * adjacent moment pairs unless an explicit {@link TimelineDiffRunOptions.fromMomentId}
 * / {@link TimelineDiffRunOptions.toMomentId} pair is supplied.
 */
export async function runTimelineDiff(timelinePath: string, options: TimelineDiffRunOptions = {}): Promise<TimelineDiffRunResult> {
    const logger = initLogger(!!options.verbose, 'calm-timeline-diff');
    const resolvedPath = path.resolve(timelinePath);
    logger.info(`Diffing timeline ${resolvedPath}`);
    const timeline = readDocument(resolvedPath) as TimelineInput;
    return diffTimeline(timeline, createFileSystemArchitectureResolver(path.dirname(resolvedPath)), options);
}
