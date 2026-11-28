import {
    diffArchitectures,
    diffPatterns,
    type NodesAndRelationshipsDiffResult,
    type ObligationChange,
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

function obligationText(changes: ObligationChange<{ 'unique-id'?: string }>[] | undefined) {
    const byId = new Map((changes ?? []).map((c) => [c.item['unique-id'], c]));
    return (id: string | undefined) => {
        const change = byId.get(id);
        return change ? ` (${change.from} → ${change.to})` : '';
    };
}

/**
 * Flattens a NodesAndRelationshipsDiffResult into a list of human-readable change rows for the
 * WHAT CHANGED section of the timeline's version detail panel.
 */
function diffResultToChanges(diff: NodesAndRelationshipsDiffResult): VersionChange[] {
    const changes: VersionChange[] = [];
    const nodeObligation = obligationText(diff.obligationChanged?.nodes);
    const edgeObligation = obligationText(diff.obligationChanged?.relationships);
    const listedNodes = new Set([...diff.nodesModified.map((m) => m.updated['unique-id']), ...diff.nodesRenamed.map((r) => r.newId)]);
    const listedEdges = new Set([...diff.edgesModified.map((m) => m.updated['unique-id']), ...diff.edgesRenamed.map((r) => r.newId)]);
    for (const n of diff.nodesAdded) {
        changes.push({ kind: 'add', text: `Added node ${nodeLabel(n)}` });
    }
    for (const n of diff.nodesRemoved) {
        changes.push({ kind: 'del', text: `Removed node ${nodeLabel(n)}` });
    }
    for (const m of diff.nodesModified) {
        changes.push({ kind: 'mod', text: `Modified node ${nodeLabel(m.original)}${nodeObligation(m.updated['unique-id'])}` });
    }
    for (const r of diff.nodesRenamed) {
        changes.push({ kind: 'mod', text: `Renamed node ${r.oldId} → ${r.newId}${nodeObligation(r.newId)}` });
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
        changes.push({ kind: 'mod', text: `Modified relationship ${id}${edgeObligation(m.updated['unique-id'])}` });
    }
    for (const r of diff.edgesRenamed) {
        changes.push({ kind: 'mod', text: `Renamed relationship ${r.oldId} → ${r.newId}${edgeObligation(r.newId)}` });
    }
    for (const c of diff.obligationChanged?.nodes ?? []) {
        if (listedNodes.has(c.item['unique-id'])) continue;
        changes.push({ kind: 'mod', text: `Modified node ${nodeLabel(c.item)}${nodeObligation(c.item['unique-id'])}` });
    }
    for (const c of diff.obligationChanged?.relationships ?? []) {
        if (listedEdges.has(c.item['unique-id'])) continue;
        const id = c.item['unique-id'] ?? 'relationship';
        changes.push({ kind: 'mod', text: `Modified relationship ${id}${edgeObligation(c.item['unique-id'])}` });
    }
    const minItems = diff.minItemsChanged;
    if (minItems?.nodes) {
        changes.push({ kind: 'mod', text: `Changed nodes minItems ${minItems.nodes.from} → ${minItems.nodes.to}` });
    }
    if (minItems?.relationships) {
        changes.push({ kind: 'mod', text: `Changed relationships minItems ${minItems.relationships.from} → ${minItems.relationships.to}` });
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
