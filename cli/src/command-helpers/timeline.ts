import path from 'path';
import { mkdirp } from 'mkdirp';
import { readFileSync, writeFileSync } from 'fs';
import { initLogger } from '@finos/calm-shared';

export const CALM_TIMELINE_SCHEMA = 'https://calm.finos.org/release/1.2/meta/calm-timeline.json';

export interface TimelineGenerateOptions {
    /** Architecture files, in the order they should appear as moments. */
    architecturePaths: string[];
    /** Output file path; when omitted the timeline is written to stdout. */
    outputPath?: string;
    verbose: boolean;
}

interface Moment {
    'unique-id': string;
    'node-type': 'moment';
    name: string;
    description: string;
    details: {
        'detailed-architecture': string;
    };
}

interface ImpliedTimeline {
    $schema: string;
    'current-moment'?: string;
    moments: Moment[];
}

/**
 * Reads an architecture file and returns its `name`/`description` when present.
 * Returns an empty object (rather than throwing) when the file is missing or
 * unparseable, so the synthesised moment can fall back to filename-derived
 * metadata — generation should not require every input to be valid CALM.
 */
function readArchitectureMeta(filePath: string): { name?: string; description?: string } {
    try {
        const raw = readFileSync(path.resolve(filePath), 'utf-8');
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        return {
            name: typeof parsed.name === 'string' ? parsed.name : undefined,
            description: typeof parsed.description === 'string' ? parsed.description : undefined,
        };
    } catch {
        return {};
    }
}

/** Strips the directory and extension so a filename can seed a moment id/name. */
function baseName(filePath: string): string {
    return path.basename(filePath, path.extname(filePath));
}

/**
 * Builds an implied CALM timeline from a set of local architecture files,
 * mirroring the backend's implied projection. One moment is emitted per input,
 * in input order (there are no semver versions to sort plain files by). Each
 * moment's `detailed-architecture` reference is made relative to the output
 * file's directory (or the current working directory when writing to stdout)
 * so the result is portable and reloadable by `calm validate --timeline` and
 * `calm diff --timeline`.
 */
export function buildImpliedTimeline(architecturePaths: string[], outputPath?: string): ImpliedTimeline {
    const refBaseDir = outputPath ? path.dirname(path.resolve(outputPath)) : process.cwd();

    const seenIds = new Set<string>();
    const moments: Moment[] = architecturePaths.map((archPath) => {
        const meta = readArchitectureMeta(archPath);
        const base = baseName(archPath);

        let uniqueId = base;
        let suffix = 1;
        while (seenIds.has(uniqueId)) {
            uniqueId = `${base}-${suffix++}`;
        }
        seenIds.add(uniqueId);

        const relativeRef = path.relative(refBaseDir, path.resolve(archPath));

        return {
            'unique-id': uniqueId,
            'node-type': 'moment',
            name: meta.name ?? base,
            description: meta.description ?? `Architecture moment derived from ${path.basename(archPath)}`,
            details: {
                'detailed-architecture': relativeRef,
            },
        };
    });

    const timeline: ImpliedTimeline = {
        $schema: CALM_TIMELINE_SCHEMA,
        moments,
    };

    if (moments.length > 0) {
        timeline['current-moment'] = moments[moments.length - 1]['unique-id'];
    }

    return timeline;
}

export function runTimelineGenerate(options: TimelineGenerateOptions): void {
    const logger = initLogger(options.verbose, 'calm-timeline');
    try {
        if (options.architecturePaths.length === 0) {
            throw new Error('At least one architecture file must be supplied via -a/--architecture.');
        }

        const timeline = buildImpliedTimeline(options.architecturePaths, options.outputPath);
        const serialised = JSON.stringify(timeline, null, 2);

        if (options.outputPath) {
            const dir = path.dirname(path.resolve(options.outputPath));
            mkdirp.sync(dir);
            writeFileSync(options.outputPath, serialised);
            logger.info(`Wrote implied timeline with ${timeline.moments.length} moment(s) to ${options.outputPath}`);
        } else {
            process.stdout.write(serialised + '\n');
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('An error occurred while generating the timeline: ' + message);
        if (err instanceof Error && err.stack) logger.debug(err.stack);
        process.exit(1);
    }
}
