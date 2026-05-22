import type { Node, Edge } from 'reactflow';
import type { CalmNodeSchema, CalmRelationshipSchema } from '@finos/calm-models/types';
import type { DiffResult } from '@finos/calm-models/diff';
import type { DiffEdgeData, DiffNodeData } from '../../model/diff-ui-types.js';

/**
 * Layers diff highlights onto already-parsed ReactFlow nodes/edges by matching
 * `unique-id` against the DiffResult. Works for any source whose parsed nodes
 * carry CALM `unique-id`s — architectures and patterns alike — so the
 * architecture and pattern diff transformers share identical highlight logic.
 */
export function applyDiffStatus(
    parsed: { nodes: Node[]; edges: Edge[] },
    diffResult: DiffResult | null,
    isFirst: boolean,
): { nodes: Node[]; edges: Edge[] } {
    if (!diffResult) {
        return parsed;
    }

    const nodesWithDiff = parsed.nodes.map((node) => {
        const nodeData = node.data as CalmNodeSchema;
        const uniqueId = nodeData['unique-id'];

        let diffStatus: DiffNodeData['diffStatus'] = 'unchanged';
        let originalId: string | undefined;

        if (isFirst) {
            if (diffResult.nodesRemoved.some((n) => n['unique-id'] === uniqueId)) {
                diffStatus = 'removed';
            } else if (diffResult.nodesModified.some((m) => m.original['unique-id'] === uniqueId)) {
                diffStatus = 'modified';
            } else if (diffResult.nodesRenamed.some((r) => r.newId === uniqueId)) {
                diffStatus = 'renamed';
                originalId = diffResult.nodesRenamed.find((r) => r.newId === uniqueId)?.oldId;
            }
        } else {
            if (diffResult.nodesAdded.some((n) => n['unique-id'] === uniqueId)) {
                diffStatus = 'added';
            } else if (diffResult.nodesModified.some((m) => m.updated['unique-id'] === uniqueId)) {
                diffStatus = 'modified';
            } else if (diffResult.nodesRenamed.some((r) => r.newId === uniqueId)) {
                diffStatus = 'renamed';
                originalId = diffResult.nodesRenamed.find((r) => r.newId === uniqueId)?.oldId;
            }
        }

        return {
            ...node,
            data: {
                ...nodeData,
                diffStatus,
                originalId,
            } as DiffNodeData,
            // Merge the diff highlight on top of the styling produced by the main
            // viewer's transformer (e.g. system-group dimensions) rather than replacing it.
            style: { ...node.style, ...getNodeStyle(diffStatus) },
        };
    });

    const edgesWithDiff = parsed.edges.map((edge) => {
        const edgeData = edge.data as CalmRelationshipSchema;
        const uniqueId = edgeData['unique-id'];

        let diffStatus: DiffEdgeData['diffStatus'] = 'unchanged';
        let originalId: string | undefined;

        if (isFirst) {
            if (diffResult.edgesRemoved.some((e) => e['unique-id'] === uniqueId)) {
                diffStatus = 'removed';
            } else if (diffResult.edgesModified.some((m) => m.original['unique-id'] === uniqueId)) {
                diffStatus = 'modified';
            } else if (diffResult.edgesRenamed.some((r) => r.newId === uniqueId)) {
                diffStatus = 'renamed';
                originalId = diffResult.edgesRenamed.find((r) => r.newId === uniqueId)?.oldId;
            }
        } else {
            if (diffResult.edgesAdded.some((e) => e['unique-id'] === uniqueId)) {
                diffStatus = 'added';
            } else if (diffResult.edgesModified.some((m) => m.updated['unique-id'] === uniqueId)) {
                diffStatus = 'modified';
            } else if (diffResult.edgesRenamed.some((r) => r.newId === uniqueId)) {
                diffStatus = 'renamed';
                originalId = diffResult.edgesRenamed.find((r) => r.newId === uniqueId)?.oldId;
            }
        }

        return {
            ...edge,
            data: {
                ...edgeData,
                diffStatus,
                originalId,
            } as DiffEdgeData,
            // Merge the diff colour over the main viewer's edge styling (dash, width)
            // rather than replacing it, so unchanged edges look identical to the main view.
            style: { ...edge.style, ...getEdgeStyle(diffStatus) },
        };
    });

    return {
        nodes: nodesWithDiff,
        edges: edgesWithDiff,
    };
}

function getNodeStyle(diffStatus?: string): React.CSSProperties {
    // CustomNode draws its own bordered box, so the diff highlight is a coloured ring
    // (box-shadow) around the node wrapper — visible without affecting layout/size.
    const ring = (color: string): React.CSSProperties => ({
        boxShadow: `0 0 0 3px ${color}`,
        borderRadius: '12px',
    });
    switch (diffStatus) {
    case 'added':
        return ring('#16a34a');
    case 'removed':
        return { ...ring('#dc2626'), opacity: 0.6 };
    case 'modified':
        return ring('#d97706');
    case 'renamed':
        return ring('#6366f1');
    case 'unchanged':
    default:
        return {};
    }
}

function getEdgeStyle(diffStatus?: string): React.CSSProperties {
    switch (diffStatus) {
    case 'added':
        return { stroke: '#16a34a', strokeWidth: 3 };
    case 'removed':
        return { stroke: '#dc2626', strokeWidth: 3, opacity: 0.6 };
    case 'modified':
        return { stroke: '#d97706', strokeWidth: 3 };
    case 'renamed':
        return { stroke: '#6366f1', strokeWidth: 3 };
    case 'unchanged':
    default:
        return {};
    }
}
