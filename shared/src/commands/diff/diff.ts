import * as fs from 'node:fs';
import * as path from 'node:path';
import { mkdirp } from 'mkdirp';
import {
    diffArchitectures,
    diffPatterns,
    diffTimelineAdjacent,
    diffTimelineMoments,
    type ArchitectureResolver,
    type MomentDiff,
    type NodesAndRelationshipsDiffResult,
    type TimelineInput,
} from '@finos/calm-models/diff';
import type { CalmArchitectureSchema, CalmNodeSchema, CalmRelationshipSchema } from '@finos/calm-models/types';
import { initLogger } from '../../logger.js';

export type DiffOutputFormat = 'json' | 'summary';

export type DiffDocumentType = 'architecture' | 'pattern';

export interface DiffRunOptions {
    format?: DiffOutputFormat;
    outputPath?: string;
    verbose?: boolean;
    /** Override automatic architecture/pattern detection. */
    documentType?: DiffDocumentType;
}

export interface DiffRunResult {
    diff: NodesAndRelationshipsDiffResult;
    formatted: string;
    hasChanges: boolean;
}

export function hasChanges(diff: NodesAndRelationshipsDiffResult): boolean {
    return (
        diff.nodesAdded.length > 0 ||
        diff.nodesRemoved.length > 0 ||
        diff.nodesModified.length > 0 ||
        diff.nodesRenamed.length > 0 ||
        diff.edgesAdded.length > 0 ||
        diff.edgesRemoved.length > 0 ||
        diff.edgesModified.length > 0 ||
        diff.edgesRenamed.length > 0 ||
        (diff.invalidItems?.nodes.length ?? 0) > 0 ||
        (diff.invalidItems?.relationships.length ?? 0) > 0 ||
        (diff.undiffableItems?.nodes.length ?? 0) > 0 ||
        (diff.undiffableItems?.relationships.length ?? 0) > 0
    );
}

/**
 * Label for a node/relationship in the summary view. Falls back to a content
 * hint for pattern items that have no pinned `unique-id`, so they don't render
 * as `undefined`.
 */
function nodeLabel(node: CalmNodeSchema): string {
    const item = node as Record<string, unknown>;
    if (typeof item['unique-id'] === 'string') return item['unique-id'];
    const detail = [item['node-type'], item['name']].filter((v) => typeof v === 'string').join(' ');
    return detail ? `(unpinned ${detail})` : '(unpinned node)';
}

function edgeLabel(edge: CalmRelationshipSchema): string {
    const item = edge as Record<string, unknown>;
    return typeof item['unique-id'] === 'string' ? item['unique-id'] : '(unpinned relationship)';
}

export function formatDiff(
    diff: NodesAndRelationshipsDiffResult,
    format: DiffOutputFormat,
    documentType: DiffDocumentType = 'architecture',
): string {
    if (format === 'json') {
        return JSON.stringify(diff, null, 2);
    }
    const invalidNodes = diff.invalidItems?.nodes.length ?? 0;
    const invalidEdges = diff.invalidItems?.relationships.length ?? 0;
    const undiffableNodes = diff.undiffableItems?.nodes.length ?? 0;
    const undiffableEdges = diff.undiffableItems?.relationships.length ?? 0;
    const title = `CALM ${documentType} diff`;
    const lines = [
        title,
        '-'.repeat(title.length),
        `Nodes:         +${diff.nodesAdded.length}  -${diff.nodesRemoved.length}  ~${diff.nodesModified.length}  ↔${diff.nodesRenamed.length}  =${diff.nodesSame.length}`,
        `Relationships: +${diff.edgesAdded.length}  -${diff.edgesRemoved.length}  ~${diff.edgesModified.length}  ↔${diff.edgesRenamed.length}  =${diff.edgesSame.length}`,
    ];
    if (invalidNodes + invalidEdges > 0) {
        lines.push(`Invalid items: ${invalidNodes} node(s) + ${invalidEdges} relationship(s) skipped (missing unique-id)`);
    }
    if (undiffableNodes + undiffableEdges > 0) {
        lines.push(`Undiffable items: ${undiffableNodes} node(s) + ${undiffableEdges} relationship(s) (no constrained unique-id to diff by)`);
    }
    lines.push('');
    const list = (label: string, ids: string[]) => {
        if (ids.length === 0) return;
        lines.push(label);
        for (const id of ids) lines.push(`  - ${id}`);
        lines.push('');
    };
    list('Nodes added:', diff.nodesAdded.map(nodeLabel));
    list('Nodes removed:', diff.nodesRemoved.map(nodeLabel));
    list('Nodes modified:', diff.nodesModified.map((n) => nodeLabel(n.original)));
    list('Nodes renamed:', diff.nodesRenamed.map((r) => `${r.oldId} -> ${r.newId}`));
    list('Relationships added:', diff.edgesAdded.map(edgeLabel));
    list('Relationships removed:', diff.edgesRemoved.map(edgeLabel));
    list('Relationships modified:', diff.edgesModified.map((e) => edgeLabel(e.original)));
    list('Relationships renamed:', diff.edgesRenamed.map((r) => `${r.oldId} -> ${r.newId}`));
    return lines.join('\n');
}

function readDocument(filePath: string): Record<string, unknown> {
    const resolved = path.resolve(filePath);
    const raw = fs.readFileSync(resolved, 'utf-8');
    return JSON.parse(raw) as Record<string, unknown>;
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function looksLikePattern(doc: Record<string, unknown>): boolean {
    const hasNodeOrRelProps = (schema: Record<string, unknown>): boolean => {
        const props = isObject(schema['properties']) ? schema['properties'] : undefined;
        return !!props && (isObject(props['nodes']) || isObject(props['relationships']));
    };
    if (hasNodeOrRelProps(doc)) return true;
    return Array.isArray(doc['allOf'])
        && doc['allOf'].some((sub) => isObject(sub) && hasNodeOrRelProps(sub));
}

/**
 * Classifies a document as an architecture instance (top-level
 * `nodes`/`relationships` arrays) or a pattern (a JSON Schema describing those
 * arrays under `properties`/`allOf`). Returns `null` when the input clearly
 * matches neither shape, leaving the decision to the caller.
 */
export function tryDetectDocumentType(doc: Record<string, unknown>): DiffDocumentType | null {
    if (Array.isArray(doc['nodes']) || Array.isArray(doc['relationships'])) {
        return 'architecture';
    }
    if (looksLikePattern(doc)) {
        return 'pattern';
    }
    return null;
}

/**
 * Like {@link tryDetectDocumentType} but throws when the input matches neither
 * shape, so malformed input is surfaced rather than silently diffed to an empty
 * result.
 */
export function detectDocumentType(doc: Record<string, unknown>): DiffDocumentType {
    const detected = tryDetectDocumentType(doc);
    if (detected) {
        return detected;
    }
    throw new Error(
        'Could not determine the CALM document type: expected an architecture ' +
            '(top-level nodes/relationships arrays) or a pattern (a JSON Schema ' +
            'describing them). Pass --type architecture|pattern to specify it explicitly.',
    );
}

export async function runDiff(
    docAPath: string,
    docBPath: string,
    options: DiffRunOptions = {},
): Promise<DiffRunResult> {
    const logger = initLogger(!!options.verbose, 'calm-diff');
    const format = options.format ?? 'json';

    logger.info(`Comparing ${docAPath} -> ${docBPath}`);
    const docA = readDocument(docAPath);
    const docB = readDocument(docBPath);

    let documentType: DiffDocumentType;
    if (options.documentType) {
        // An explicit --type overrides auto-detection (and rescues genuinely
        // ambiguous inputs), but if a document's content confidently matches the
        // opposite type the override is almost certainly a mistake — fail loudly
        // rather than emit a misleading empty diff.
        documentType = options.documentType;
        for (const [docPath, doc] of [[docAPath, docA], [docBPath, docB]] as const) {
            const detected = tryDetectDocumentType(doc);
            if (detected && detected !== documentType) {
                throw new Error(
                    `--type was set to '${documentType}', but ${docPath} matches '${detected}'. ` +
                        'Remove --type to auto-detect, or pass inputs of the forced type.',
                );
            }
        }
    } else {
        const typeA = detectDocumentType(docA);
        const typeB = detectDocumentType(docB);
        if (typeA !== typeB) {
            throw new Error(
                `Cannot diff mismatched document types: ${typeA} vs ${typeB}. Both inputs must be the ` +
                    'same CALM document type; pass --type to override detection.',
            );
        }
        documentType = typeA;
    }

    const diff = documentType === 'pattern'
        ? diffPatterns(docA, docB)
        : diffArchitectures(docA as CalmArchitectureSchema, docB as CalmArchitectureSchema);

    const invalidNodeCount = diff.invalidItems?.nodes.length ?? 0;
    const invalidEdgeCount = diff.invalidItems?.relationships.length ?? 0;
    if (invalidNodeCount + invalidEdgeCount > 0) {
        logger.warn(
            `Skipped ${invalidNodeCount} node(s) and ${invalidEdgeCount} relationship(s) ` +
                'because they were missing a unique-id. These items are reported under ' +
                'invalidItems and contribute to hasChanges so --exit-code does not pass on them silently.',
        );
    }

    const undiffableNodeCount = diff.undiffableItems?.nodes.length ?? 0;
    const undiffableEdgeCount = diff.undiffableItems?.relationships.length ?? 0;
    if (undiffableNodeCount + undiffableEdgeCount > 0) {
        logger.warn(
            `Could not diff ${undiffableNodeCount} node(s) and ${undiffableEdgeCount} relationship(s) ` +
                'because they constrain no comparable content (e.g. an unconstrained unique-id). ' +
                'These items are reported under undiffableItems and contribute to hasChanges so ' +
                '--exit-code does not pass on them silently.',
        );
    }

    const formatted = formatDiff(diff, format, documentType);

    if (options.outputPath) {
        const dir = path.dirname(path.resolve(options.outputPath));
        mkdirp.sync(dir);
        fs.writeFileSync(options.outputPath, formatted);
        logger.info(`Wrote diff to ${options.outputPath}`);
    }

    return { diff, formatted, hasChanges: hasChanges(diff) };
}

export interface TimelineDiffRunOptions {
    /** Diff only this single pair instead of all adjacent pairs. */
    fromMomentId?: string;
    toMomentId?: string;
    verbose?: boolean;
}

export interface TimelineDiffRunResult {
    /** Ordered diffs: one per adjacent pair, or a single entry for an explicit pair. */
    diffs: MomentDiff[];
}

/**
 * Builds a filesystem-backed {@link ArchitectureResolver} that resolves a
 * moment's `detailed-architecture` string reference relative to the directory
 * of the timeline document being diffed.
 */
export function createFileSystemArchitectureResolver(baseDir: string): ArchitectureResolver {
    return async (reference: string) => {
        const resolved = path.isAbsolute(reference)
            ? reference
            : path.resolve(baseDir, reference);
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
export async function runTimelineDiff(
    timelinePath: string,
    options: TimelineDiffRunOptions = {},
): Promise<TimelineDiffRunResult> {
    const logger = initLogger(!!options.verbose, 'calm-timeline-diff');
    const resolvedPath = path.resolve(timelinePath);
    logger.info(`Diffing timeline ${resolvedPath}`);

    const timeline = readDocument(resolvedPath) as TimelineInput;
    const resolver = createFileSystemArchitectureResolver(path.dirname(resolvedPath));

    if (options.fromMomentId || options.toMomentId) {
        if (!options.fromMomentId || !options.toMomentId) {
            throw new Error(
                'Both fromMomentId and toMomentId must be supplied to diff a specific pair.',
            );
        }
        const diff = await diffTimelineMoments(
            timeline,
            options.fromMomentId,
            options.toMomentId,
            resolver,
        );
        return { diffs: [diff] };
    }

    const diffs = await diffTimelineAdjacent(timeline, resolver);
    return { diffs };
}
