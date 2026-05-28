import {
    diffArchitectures,
    diffPatterns,
    type DiffResult,
} from '@finos/calm-models/diff';
import type { CalmArchitectureSchema } from '@finos/calm-models/types';

type ChangeKind = 'add' | 'mod' | 'del';

export interface VersionChange {
    kind: ChangeKind;
    text: string;
}

function nodeLabel(node: { name?: string; 'unique-id'?: string }): string {
    return node.name || node['unique-id'] || 'node';
}

/**
 * Flattens a DiffResult into a list of human-readable change rows for the
 * WHAT CHANGED section of the timeline's version detail panel.
 */
function diffResultToChanges(diff: DiffResult): VersionChange[] {
    const changes: VersionChange[] = [];
    for (const n of diff.nodesAdded) {
        changes.push({ kind: 'add', text: `Added node ${nodeLabel(n)}` });
    }
    for (const n of diff.nodesRemoved) {
        changes.push({ kind: 'del', text: `Removed node ${nodeLabel(n)}` });
    }
    for (const m of diff.nodesModified) {
        changes.push({ kind: 'mod', text: `Modified node ${nodeLabel(m.original)}` });
    }
    for (const r of diff.nodesRenamed) {
        changes.push({ kind: 'mod', text: `Renamed node ${r.oldId} → ${r.newId}` });
    }
    for (const e of diff.edgesAdded) {
        const id = e['unique-id'] ?? 'relationship';
        changes.push({ kind: 'add', text: `Added relationship ${id}` });
    }
    for (const e of diff.edgesRemoved) {
        const id = e['unique-id'] ?? 'relationship';
        changes.push({ kind: 'del', text: `Removed relationship ${id}` });
    }
    for (const m of diff.edgesModified) {
        const id = m.original['unique-id'] ?? 'relationship';
        changes.push({ kind: 'mod', text: `Modified relationship ${id}` });
    }
    for (const r of diff.edgesRenamed) {
        changes.push({ kind: 'mod', text: `Renamed relationship ${r.oldId} → ${r.newId}` });
    }
    return changes;
}

/**
 * Diffs two CALM documents (architecture or pattern) and returns the change
 * list. Returns an empty list if either side is missing.
 */
export function computeChanges(
    calmType: 'Architectures' | 'Patterns',
    previous: unknown,
    current: unknown
): VersionChange[] {
    if (!previous || !current) return [];
    const diff =
        calmType === 'Patterns'
            ? diffPatterns(
                  previous as Record<string, unknown>,
                  current as Record<string, unknown>
              )
            : diffArchitectures(
                  previous as CalmArchitectureSchema,
                  current as CalmArchitectureSchema
              );
    return diffResultToChanges(diff);
}
