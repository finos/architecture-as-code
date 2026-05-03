import { Node, Edge } from 'reactflow';
import { CalmArchitectureSchema, CalmNodeSchema, CalmRelationshipSchema } from '@finos/calm-models/types';
import { parseCALMData } from '../../../visualizer/components/reactflow/utils/calmTransformer.js';
import { DiffEdgeData, DiffNodeData, DiffResult } from '../../../model/diff.js';

/**
 * Parses CALM data with diff highlighting applied
 */
export function parseCALMDataWithDiff(
    data: CalmArchitectureSchema,
    diffResult: DiffResult | null,
    isFirst: boolean
): { nodes: Node[]; edges: Edge[] } {
    const baseResult = parseCALMData(data);

    if (!diffResult) {
        return baseResult;
    }

    // Apply diff status to nodes
    const nodesWithDiff = baseResult.nodes.map(node => {
        const nodeData = node.data as CalmNodeSchema;
        const uniqueId = nodeData['unique-id'];

        let diffStatus: DiffNodeData['diffStatus'] = 'unchanged';
        let originalId: string | undefined;

        if (isFirst) {
            // For first architecture
            if (diffResult.nodesRemoved.some(n => n['unique-id'] === uniqueId)) {
                diffStatus = 'removed';
            } else if (diffResult.nodesModified.some(m => m.original['unique-id'] === uniqueId)) {
                diffStatus = 'modified';
            } else if (diffResult.nodesRenamed.some(r => r.newId === uniqueId)) {
                diffStatus = 'renamed';
                originalId = diffResult.nodesRenamed.find(r => r.newId === uniqueId)?.oldId;
            } else if (!diffResult.nodesAdded.some(n => n['unique-id'] === uniqueId) &&
                       !diffResult.nodesRemoved.some(n => n['unique-id'] === uniqueId) &&
                       !diffResult.nodesRenamed.some(r => r.newId === uniqueId)) {
                diffStatus = 'unchanged';
            }
        } else {
            // For second architecture
            if (diffResult.nodesAdded.some(n => n['unique-id'] === uniqueId)) {
                diffStatus = 'added';
            } else if (diffResult.nodesModified.some(m => m.updated['unique-id'] === uniqueId)) {
                diffStatus = 'modified';
            } else if (diffResult.nodesRenamed.some(r => r.newId === uniqueId)) {
                diffStatus = 'renamed';
                originalId = diffResult.nodesRenamed.find(r => r.newId === uniqueId)?.oldId;
            } else if (!diffResult.nodesRemoved.some(n => n['unique-id'] === uniqueId) &&
                       !diffResult.nodesAdded.some(n => n['unique-id'] === uniqueId) &&
                       !diffResult.nodesRenamed.some(r => r.newId === uniqueId)) {
                diffStatus = 'unchanged';
            }
        }

        return {
            ...node,
            data: {
                ...nodeData,
                diffStatus,
                originalId,
            } as DiffNodeData,
            style: getNodeStyle(diffStatus),
        };
    });

    // Apply diff status to edges
    const edgesWithDiff = baseResult.edges.map(edge => {
        const edgeData = edge.data as CalmRelationshipSchema;
        const uniqueId = edgeData['unique-id'];

        let diffStatus: DiffEdgeData['diffStatus'] = 'unchanged';
        let originalId: string | undefined;

        if (isFirst) {
            // For first architecture
            if (diffResult.edgesRemoved.some(e => e['unique-id'] === uniqueId)) {
                diffStatus = 'removed';
            } else if (diffResult.edgesModified.some(m => m.original['unique-id'] === uniqueId)) {
                diffStatus = 'modified';
            } else if (diffResult.edgesRenamed.some(r => r.newId === uniqueId)) {
                diffStatus = 'renamed';
                originalId = diffResult.edgesRenamed.find(r => r.newId === uniqueId)?.oldId;
            } else if (!diffResult.edgesAdded.some(e => e['unique-id'] === uniqueId) &&
                       !diffResult.edgesRemoved.some(e => e['unique-id'] === uniqueId) &&
                       !diffResult.edgesRenamed.some(r => r.newId === uniqueId)) {
                diffStatus = 'unchanged';
            }
        } else {
            // For second architecture
            if (diffResult.edgesAdded.some(e => e['unique-id'] === uniqueId)) {
                diffStatus = 'added';
            } else if (diffResult.edgesModified.some(m => m.updated['unique-id'] === uniqueId)) {
                diffStatus = 'modified';
            } else if (diffResult.edgesRenamed.some(r => r.newId === uniqueId)) {
                diffStatus = 'renamed';
                originalId = diffResult.edgesRenamed.find(r => r.newId === uniqueId)?.oldId;
            } else if (!diffResult.edgesRemoved.some(e => e['unique-id'] === uniqueId) &&
                       !diffResult.edgesAdded.some(e => e['unique-id'] === uniqueId) &&
                       !diffResult.edgesRenamed.some(r => r.newId === uniqueId)) {
                diffStatus = 'unchanged';
            }
        }

        return {
            ...edge,
            data: {
                ...edgeData,
                diffStatus,
                originalId,
            } as DiffEdgeData,
            style: getEdgeStyle(diffStatus),
        };
    });

    return {
        nodes: nodesWithDiff,
        edges: edgesWithDiff,
    };
}

/**
 * Get node styling based on diff status
 */
function getNodeStyle(diffStatus?: string): React.CSSProperties {
    const baseStyle: React.CSSProperties = {};

    switch (diffStatus) {
        case 'added':
            return { ...baseStyle, borderColor: '#16a34a', borderWidth: 2 };
        case 'removed':
            return { ...baseStyle, borderColor: '#dc2626', borderWidth: 2, opacity: 0.6 };
        case 'modified':
            return { ...baseStyle, borderColor: '#d97706', borderWidth: 2 };
        case 'renamed':
            return { ...baseStyle, borderColor: '#6366f1', borderWidth: 2 };
        case 'unchanged':
        default:
            return baseStyle;
    }
}

/**
 * Get edge styling based on diff status
 */
function getEdgeStyle(diffStatus?: string): React.CSSProperties {
    const baseStyle: React.CSSProperties = {};

    switch (diffStatus) {
        case 'added':
            return { ...baseStyle, stroke: '#16a34a', strokeWidth: 3 };
        case 'removed':
            return { ...baseStyle, stroke: '#dc2626', strokeWidth: 3, opacity: 0.6 };
        case 'modified':
            return { ...baseStyle, stroke: '#d97706', strokeWidth: 3 };
        case 'renamed':
            return { ...baseStyle, stroke: '#6366f1', strokeWidth: 3 };
        case 'unchanged':
        default:
            return baseStyle;
    }
}