import { NodeData, EdgeData } from '../../../contracts/contracts.js';

const NODE_DISPLAY_KEYS = ['label'] as const;
const EDGE_DISPLAY_KEYS = ['id', 'label', 'source', 'target'] as const;

function omitKeys<T extends Record<string, unknown>>(obj: T, keys: readonly string[]): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
        if (!keys.includes(key)) {
            result[key] = value;
        }
    }
    return result;
}

/**
 * Converts raw pattern node data from ReactFlow into a NodeData object for the sidebar.
 * Passes through all CALM schema fields (unique-id, node-type, interfaces, controls, etc.)
 * Strips the 'label' field which is a ReactFlow display artifact (duplicates 'name').
 */
export function toPatternNodeData(nodeData: Record<string, unknown>): NodeData {
    return omitKeys(nodeData, NODE_DISPLAY_KEYS) as NodeData;
}

/**
 * Converts raw pattern edge data from ReactFlow into an EdgeData object for the sidebar.
 * Passes through all CALM schema fields (unique-id, relationship-type, protocol, controls, etc.)
 * Strips ReactFlow artifacts: id (edge ID), label (duplicate of description), source/target
 * (derived convenience fields — actual source/target lives inside relationship-type).
 */
export function toPatternEdgeData(edgeData: Record<string, unknown>): EdgeData {
    return omitKeys(edgeData, EDGE_DISPLAY_KEYS) as EdgeData;
}
