import { NodeData, EdgeData } from '../../../contracts/contracts.js';

/**
 * Converts raw pattern node data from ReactFlow into a NodeData object for the sidebar.
 * Passes through all CALM schema fields (unique-id, node-type, interfaces, controls, etc.)
 * Strips the 'label' field which is a ReactFlow display artifact (duplicates 'name').
 */
export function toPatternNodeData(nodeData: Record<string, unknown>): NodeData {
    const { label: _label, ...calmFields } = nodeData;
    return calmFields as NodeData;
}

/**
 * Converts raw pattern edge data from ReactFlow into an EdgeData object for the sidebar.
 * Passes through all CALM schema fields (unique-id, relationship-type, protocol, controls, etc.)
 */
export function toPatternEdgeData(edgeData: Record<string, unknown>): EdgeData {
    return edgeData as EdgeData;
}
