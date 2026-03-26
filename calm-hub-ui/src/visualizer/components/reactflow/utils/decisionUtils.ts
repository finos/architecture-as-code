import { Node, Edge } from 'reactflow';

export interface DecisionPoint {
    groupId: string;
    decisionType: 'oneOf' | 'anyOf';
    prompt: string;
    choices: { description: string; nodes: string[]; relationships: string[] }[];
}

export type DecisionSelections = Map<string, number[]>;

/**
 * Extracts decision points from decisionGroup nodes that have choices data.
 */
export function extractDecisionPoints(nodes: Node[]): DecisionPoint[] {
    const points: DecisionPoint[] = [];
    for (const node of nodes) {
        if (node.type === 'decisionGroup' && Array.isArray(node.data?.choices) && node.data.choices.length > 0) {
            points.push({
                groupId: node.id,
                decisionType: node.data.decisionType || 'oneOf',
                prompt: node.data.prompt || 'Decision',
                choices: node.data.choices,
            });
        }
    }
    return points;
}

/**
 * Returns true if any decision has an active selection.
 */
export function isDecisionFilterActive(selections: DecisionSelections): boolean {
    for (const indices of selections.values()) {
        if (indices.length > 0) return true;
    }
    return false;
}

/**
 * Collects all node IDs referenced by any choice across all decisions.
 */
export function getDecisionGovernedNodeIds(decisionPoints: DecisionPoint[]): Set<string> {
    const ids = new Set<string>();
    for (const dp of decisionPoints) {
        for (const choice of dp.choices) {
            for (const id of choice.nodes) {
                ids.add(id);
            }
        }
    }
    return ids;
}

/**
 * Collects all relationship IDs referenced by any choice across all decisions.
 */
export function getDecisionGovernedRelationshipIds(decisionPoints: DecisionPoint[]): Set<string> {
    const ids = new Set<string>();
    for (const dp of decisionPoints) {
        for (const choice of dp.choices) {
            for (const id of choice.relationships) {
                ids.add(id);
            }
        }
    }
    return ids;
}

/**
 * Computes which node IDs should be visible given the current selections.
 * Returns null when no filter is active (show all).
 */
export function getVisibleNodeIds(
    nodes: Node[],
    decisionPoints: DecisionPoint[],
    selections: DecisionSelections
): Set<string> | null {
    if (!isDecisionFilterActive(selections)) return null;

    const governedNodeIds = getDecisionGovernedNodeIds(decisionPoints);
    const visibleIds = new Set<string>();

    for (const dp of decisionPoints) {
        const selectedIndices = selections.get(dp.groupId);
        if (!selectedIndices || selectedIndices.length === 0) {
            // No selection for this decision — show all its options
            for (const choice of dp.choices) {
                for (const id of choice.nodes) visibleIds.add(id);
            }
        } else {
            for (const idx of selectedIndices) {
                if (idx >= 0 && idx < dp.choices.length) {
                    for (const id of dp.choices[idx].nodes) visibleIds.add(id);
                }
            }
        }
    }

    // Always-present nodes: not governed by any decision, plus group/decisionGroup nodes
    for (const node of nodes) {
        if (node.type === 'group' || node.type === 'decisionGroup') {
            visibleIds.add(node.id);
        } else if (!governedNodeIds.has(node.id)) {
            visibleIds.add(node.id);
        }
    }

    return visibleIds;
}

/**
 * Computes which edge IDs should be visible given the current selections.
 */
export function getVisibleEdgeIds(
    edges: Edge[],
    visibleNodeIds: Set<string>,
    decisionPoints: DecisionPoint[],
    selections: DecisionSelections
): Set<string> {
    const governedRelIds = getDecisionGovernedRelationshipIds(decisionPoints);

    // Build set of selected relationship IDs
    const selectedRelIds = new Set<string>();
    for (const dp of decisionPoints) {
        const selectedIndices = selections.get(dp.groupId);
        if (!selectedIndices || selectedIndices.length === 0) {
            // No selection — show all relationships for this decision
            for (const choice of dp.choices) {
                for (const id of choice.relationships) selectedRelIds.add(id);
            }
        } else {
            for (const idx of selectedIndices) {
                if (idx >= 0 && idx < dp.choices.length) {
                    for (const id of dp.choices[idx].relationships) selectedRelIds.add(id);
                }
            }
        }
    }

    const visibleEdges = new Set<string>();
    for (const edge of edges) {
        const edgeUniqueId = edge.data?.['unique-id'] as string | undefined;

        if (edgeUniqueId && governedRelIds.has(edgeUniqueId)) {
            if (selectedRelIds.has(edgeUniqueId)) {
                visibleEdges.add(edge.id);
            }
        } else {
            // Not governed by any decision — show if both endpoints are visible
            if (visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)) {
                visibleEdges.add(edge.id);
            }
        }
    }

    return visibleEdges;
}
