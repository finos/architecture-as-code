// Ported from calm-hub-ui/src/visualizer/components/reactflow/utils/calmTransformer.ts (commit 56c9ee8f).
// Keep logic in sync until the shared renderer package extraction.

import {
    getLayoutedElements,
    createTopLevelLayout,
    calculateChildBounds,
    sortContainersDeepestFirst,
    sortNodesParentsBeforeChildren,
} from './layoutUtils';
import { identifyContainerNodes, parseNodes } from './nodeParser';
import { extractFlowTransitions, parseRelationships } from './relationshipParser';
import { GRAPH_LAYOUT } from './constants';

/**
 * Parses CALM architecture data into ReactFlow nodes and edges
 */
export function parseCALMData(data, onShowDetailsCallback) {
    if (!data) return { nodes: [], edges: [] };

    try {
        const relationships = data.relationships || [];
        const nodes = data.nodes || [];
        const flows = data.flows || [];

        const containerInfo = identifyContainerNodes(relationships, nodes);
        const { regularNodes, systemNodes } = parseNodes(nodes, containerInfo, onShowDetailsCallback);
        const flowTransitions = extractFlowTransitions(flows);
        const edges = parseRelationships(relationships, flowTransitions);

        return applyLayout(regularNodes, systemNodes, edges);
    } catch (error) {
        console.error('Error parsing CALM data:', error);
        return { nodes: [], edges: [] };
    }
}

/**
 * Applies layout to nodes, handling system nodes and their children
 */
function applyLayout(regularNodes, systemNodes, edges) {
    const { nodesWithParents, nodesWithoutParents, topLevelSystemNodes } = separateNodesByParent(
        regularNodes,
        systemNodes
    );

    layoutChildrenWithinSystems(systemNodes, nodesWithParents, edges);
    const positions = layoutTopLevelNodes(nodesWithoutParents, topLevelSystemNodes, nodesWithParents, edges);

    applyPositionsToNodes(nodesWithoutParents, positions);
    applyPositionsToNodes(topLevelSystemNodes, positions);

    const allNodes = combineNodes(topLevelSystemNodes, nodesWithoutParents, nodesWithParents, systemNodes);

    return { nodes: allNodes, edges };
}

/**
 * Separates nodes into groups based on whether they have a parent
 */
function separateNodesByParent(regularNodes, systemNodes) {
    const nodesWithParents = [];
    const nodesWithoutParents = [];
    const topLevelSystemNodes = [];

    regularNodes.forEach((node) => {
        if (node.parentId) {
            nodesWithParents.push(node);
        } else {
            nodesWithoutParents.push(node);
        }
    });

    systemNodes.forEach((node) => {
        if (node.parentId) {
            nodesWithParents.push(node);
        } else {
            nodesWithoutParents.push(node);
            topLevelSystemNodes.push(node);
        }
    });

    return { nodesWithParents, nodesWithoutParents, topLevelSystemNodes };
}

/**
 * Layouts children within each system node and calculates system dimensions
 */
function layoutChildrenWithinSystems(systemNodes, nodesWithParents, edges) {
    // Lay out the most deeply nested containers first so that an outer
    // container is sized once its inner container children already know their
    // own dimensions.
    sortContainersDeepestFirst(systemNodes).forEach((systemNode) => {
        const childNodes = nodesWithParents.filter((n) => n.parentId === systemNode.id);

        if (childNodes.length > 0) {
            layoutSystemWithChildren(systemNode, childNodes, nodesWithParents, edges);
        } else {
            setDefaultSystemDimensions(systemNode);
        }
    });
}

/**
 * Layouts a system node with its children
 */
function layoutSystemWithChildren(systemNode, childNodes, nodesWithParents, edges) {
    const systemEdges = edges.filter(
        (e) => childNodes.some((n) => n.id === e.source) && childNodes.some((n) => n.id === e.target)
    );

    const { nodes: layoutedChildren } = getLayoutedElements(childNodes, systemEdges);
    const bounds = calculateChildBounds(layoutedChildren);
    const padding = GRAPH_LAYOUT.SYSTEM_NODE_PADDING;

    const width = bounds.maxX - bounds.minX + padding * 2;
    const height = bounds.maxY - bounds.minY + padding * 2;

    systemNode.width = width;
    systemNode.height = height;
    systemNode.style = { ...systemNode.style, width, height };

    layoutedChildren.forEach((child) => {
        const originalChild = nodesWithParents.find((n) => n.id === child.id);
        if (originalChild) {
            originalChild.position = {
                x: child.position.x - bounds.minX + padding,
                y: child.position.y - bounds.minY + padding,
            };
        }
    });
}

/**
 * Sets default dimensions for a system node without children
 */
function setDefaultSystemDimensions(systemNode) {
    const width = GRAPH_LAYOUT.SYSTEM_NODE_DEFAULT_WIDTH;
    const height = GRAPH_LAYOUT.SYSTEM_NODE_DEFAULT_HEIGHT;

    systemNode.width = width;
    systemNode.height = height;
    systemNode.style = { ...systemNode.style, width, height };
}

/**
 * Creates the top-level layout for nodes not inside systems
 */
function layoutTopLevelNodes(nodesWithoutParents, topLevelSystemNodes, nodesWithParents, edges) {
    const systemNodesForLayout = topLevelSystemNodes.map((s) => ({ ...s }));

    const topLevelEdges = edges.filter((e) => {
        const sourceInSystem = nodesWithParents.some((n) => n.id === e.source);
        const targetInSystem = nodesWithParents.some((n) => n.id === e.target);
        return !sourceInSystem || !targetInSystem;
    });

    const topLevelNodes = [...nodesWithoutParents, ...systemNodesForLayout];
    return createTopLevelLayout(topLevelNodes, topLevelEdges);
}

/**
 * Applies positions from layout to nodes
 */
function applyPositionsToNodes(nodes, positions) {
    nodes.forEach((node) => {
        const pos = positions.get(node.id);
        if (pos) {
            node.position = pos;
        }
    });
}

/**
 * Combines all nodes in the correct order for ReactFlow
 */
function combineNodes(topLevelSystemNodes, nodesWithoutParents, nodesWithParents, systemNodes) {
    return sortNodesParentsBeforeChildren([
        ...topLevelSystemNodes,
        ...nodesWithoutParents.filter((n) => !systemNodes.includes(n)),
        ...nodesWithParents,
    ]);
}
