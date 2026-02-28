import { CalmNodeSchema, CalmRelationshipSchema } from '@finos/calm-models/types';

const NODE_DISPLAY_FIELDS = ['label', 'onShowDetails'];
const EDGE_DISPLAY_FIELDS = ['flowTransitions', 'direction'];

function omitFields(data: Record<string, unknown>, fields: string[]): Record<string, unknown> {
    const copy = { ...data };
    for (const key of fields) delete copy[key];
    return copy;
}

/**
 * Strips ReactFlow display fields (label, onShowDetails) from node data,
 * returning only CALM fields for the sidebar.
 */
export function toSidebarNodeData(nodeData: Record<string, unknown>): CalmNodeSchema {
    return omitFields(nodeData, NODE_DISPLAY_FIELDS) as CalmNodeSchema;
}

/**
 * Strips ReactFlow display fields (flowTransitions, direction) from edge data,
 * returning only CALM fields for the sidebar.
 */
export function toSidebarEdgeData(edgeData: Record<string, unknown>): CalmRelationshipSchema {
    return omitFields(edgeData, EDGE_DISPLAY_FIELDS) as CalmRelationshipSchema;
}
