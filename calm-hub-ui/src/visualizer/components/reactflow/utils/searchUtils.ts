import { Node, Edge } from 'reactflow';

/** Resolves the CALM node type from either architecture (data.type) or pattern (data['node-type']) nodes. */
function getNodeType(node: Node): string {
    return node.data?.type || node.data?.['node-type'] || '';
}

/**
 * Checks if a node matches the current search term and type filter.
 * Group nodes (system, decisionGroup) are excluded from matching.
 */
export function isNodeMatch(node: Node, searchTerm: string, typeFilter: string): boolean {
    if (node.type === 'group' || node.type === 'decisionGroup') return true;

    const nodeType = getNodeType(node);
    const matchesType = !typeFilter || nodeType === typeFilter;
    if (!matchesType) return false;

    if (!searchTerm) return true;

    const term = searchTerm.toLowerCase();
    const label = (node.data?.label || '').toLowerCase();
    const uniqueId = (node.data?.['unique-id'] || node.id || '').toLowerCase();

    return label.includes(term) || uniqueId.includes(term) || nodeType.toLowerCase().includes(term);
}

/**
 * Returns the set of node IDs that match the current search.
 */
export function getMatchingNodeIds(nodes: Node[], searchTerm: string, typeFilter: string): Set<string> {
    const ids = new Set<string>();
    for (const node of nodes) {
        if (isNodeMatch(node, searchTerm, typeFilter)) {
            ids.add(node.id);
        }
    }
    return ids;
}

/**
 * Checks if an edge should remain visible based on matching node IDs.
 * An edge is visible if at least one of its endpoints matches.
 */
export function isEdgeVisible(edge: Edge, matchingNodeIds: Set<string>): boolean {
    return matchingNodeIds.has(edge.source) || matchingNodeIds.has(edge.target);
}

/**
 * Extracts unique node types from the current node set (excluding group types).
 */
export function getUniqueNodeTypes(nodes: Node[]): string[] {
    const types = new Set<string>();
    for (const node of nodes) {
        const nodeType = getNodeType(node);
        if (node.type !== 'group' && node.type !== 'decisionGroup' && nodeType) {
            types.add(nodeType);
        }
    }
    return Array.from(types).sort();
}
