import * as fs from 'node:fs';
import * as path from 'node:path';
import { mkdirp } from 'mkdirp';
import {
    diffArchitectures,
    type DiffResult,
} from '@finos/calm-models/diff';
import type { CalmArchitectureSchema } from '@finos/calm-models/types';
import { initLogger } from '../../logger.js';

export type DiffOutputFormat = 'json' | 'summary';

export interface DiffRunOptions {
    format?: DiffOutputFormat;
    outputPath?: string;
    verbose?: boolean;
}

export interface DiffRunResult {
    diff: DiffResult;
    formatted: string;
    hasChanges: boolean;
}

export function hasChanges(diff: DiffResult): boolean {
    return (
        diff.nodesAdded.length > 0 ||
        diff.nodesRemoved.length > 0 ||
        diff.nodesModified.length > 0 ||
        diff.nodesRenamed.length > 0 ||
        diff.edgesAdded.length > 0 ||
        diff.edgesRemoved.length > 0 ||
        diff.edgesModified.length > 0 ||
        diff.edgesRenamed.length > 0
    );
}

export function formatDiff(diff: DiffResult, format: DiffOutputFormat): string {
    if (format === 'json') {
        return JSON.stringify(diff, null, 2);
    }
    const lines = [
        'CALM architecture diff',
        '----------------------',
        `Nodes:         +${diff.nodesAdded.length}  -${diff.nodesRemoved.length}  ~${diff.nodesModified.length}  ↔${diff.nodesRenamed.length}  =${diff.nodesSame.length}`,
        `Relationships: +${diff.edgesAdded.length}  -${diff.edgesRemoved.length}  ~${diff.edgesModified.length}  ↔${diff.edgesRenamed.length}  =${diff.edgesSame.length}`,
        '',
    ];
    const list = (label: string, ids: string[]) => {
        if (ids.length === 0) return;
        lines.push(label);
        for (const id of ids) lines.push(`  - ${id}`);
        lines.push('');
    };
    list('Nodes added:', diff.nodesAdded.map((n) => n['unique-id'] as string));
    list('Nodes removed:', diff.nodesRemoved.map((n) => n['unique-id'] as string));
    list('Nodes modified:', diff.nodesModified.map((n) => n.original['unique-id'] as string));
    list('Nodes renamed:', diff.nodesRenamed.map((r) => `${r.oldId} -> ${r.newId}`));
    list('Relationships added:', diff.edgesAdded.map((e) => e['unique-id'] as string));
    list('Relationships removed:', diff.edgesRemoved.map((e) => e['unique-id'] as string));
    list('Relationships modified:', diff.edgesModified.map((e) => e.original['unique-id'] as string));
    list('Relationships renamed:', diff.edgesRenamed.map((r) => `${r.oldId} -> ${r.newId}`));
    return lines.join('\n');
}

function readArchitecture(filePath: string): CalmArchitectureSchema {
    const resolved = path.resolve(filePath);
    const raw = fs.readFileSync(resolved, 'utf-8');
    return JSON.parse(raw) as CalmArchitectureSchema;
}

export async function runDiff(
    archAPath: string,
    archBPath: string,
    options: DiffRunOptions = {},
): Promise<DiffRunResult> {
    const logger = initLogger(!!options.verbose, 'calm-diff');
    const format = options.format ?? 'json';

    logger.info(`Comparing ${archAPath} -> ${archBPath}`);
    const archA = readArchitecture(archAPath);
    const archB = readArchitecture(archBPath);

    const diff = diffArchitectures(archA, archB);
    const formatted = formatDiff(diff, format);

    if (options.outputPath) {
        const dir = path.dirname(path.resolve(options.outputPath));
        mkdirp.sync(dir);
        fs.writeFileSync(options.outputPath, formatted);
        logger.info(`Wrote diff to ${options.outputPath}`);
    }

    return { diff, formatted, hasChanges: hasChanges(diff) };
}
