import { Node, Edge } from 'reactflow';
import { CalmArchitectureSchema, CalmNodeSchema } from '../../../../../../calm-models/src/types/core-types.js';
import { getLayoutedElements, createTopLevelLayout } from './layoutUtils';
import { identifyContainerNodes, parseNodes } from './nodeParser';
import { extractFlowTransitions, parseRelationships } from './relationshipParser';
import { GRAPH_LAYOUT } from './constants';

/**
 * Result of parsing CALM data into ReactFlow elements
 */
export interface ParsedCALMData {
    nodes: Node[];
    edges: Edge[];
}

/**
 * Parses CALM architecture data into ReactFlow nodes and edges
 */
export function parseCALMData(
    data: CalmArchitectureSchema,
    onShowDetailsCallback?: (nodeData: CalmNodeSchema) => void
): ParsedCALMData {
    if (!data) return { nodes: [], edges: [] };

    try {
        const relationships = data.relationships || [];
        const nodes = data.nodes || [];
        const flows = data.flows || [];

        const containerInfo = identifyContainerNodes(relationships);
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
function applyLayout(regularNodes: Node[], systemNodes: Node[], edges: Edge[]): ParsedCALMData {
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
function separateNodesByParent(
    regularNodes: Node[],
    systemNodes: Node[]
): {
    nodesWithParents: Node[];
    nodesWithoutParents: Node[];
    topLevelSystemNodes: Node[];
} {
    const nodesWithParents: Node[] = [];
    const nodesWithoutParents: Node[] = [];
    const topLevelSystemNodes: Node[] = [];

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
function layoutChildrenWithinSystems(systemNodes: Node[], nodesWithParents: Node[], edges: Edge[]): void {
    systemNodes.forEach((systemNode) => {
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
function layoutSystemWithChildren(
    systemNode: Node,
    childNodes: Node[],
    nodesWithParents: Node[],
    edges: Edge[]
): void {
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
 * Calculates the bounding box of child nodes
 */
function calculateChildBounds(children: Node[]): { minX: number; minY: number; maxX: number; maxY: number } {
    const nodeWidth = GRAPH_LAYOUT.NODE_WIDTH;
    const nodeHeight = GRAPH_LAYOUT.NODE_HEIGHT;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    children.forEach((child) => {
        minX = Math.min(minX, child.position.x);
        minY = Math.min(minY, child.position.y);
        maxX = Math.max(maxX, child.position.x + nodeWidth);
        maxY = Math.max(maxY, child.position.y + nodeHeight);
    });

    return { minX, minY, maxX, maxY };
}

/**
 * Sets default dimensions for a system node without children
 */
function setDefaultSystemDimensions(systemNode: Node): void {
    const width = GRAPH_LAYOUT.SYSTEM_NODE_DEFAULT_WIDTH;
    const height = GRAPH_LAYOUT.SYSTEM_NODE_DEFAULT_HEIGHT;

    systemNode.width = width;
    systemNode.height = height;
    systemNode.style = { ...systemNode.style, width, height };
}

/**
 * Creates the top-level layout for nodes not inside systems
 */
function layoutTopLevelNodes(
    nodesWithoutParents: Node[],
    topLevelSystemNodes: Node[],
    nodesWithParents: Node[],
    edges: Edge[]
): Map<string, { x: number; y: number }> {
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
function applyPositionsToNodes(nodes: Node[], positions: Map<string, { x: number; y: number }>): void {
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
function combineNodes(
    topLevelSystemNodes: Node[],
    nodesWithoutParents: Node[],
    nodesWithParents: Node[],
    systemNodes: Node[]
): Node[] {
    return [
        ...topLevelSystemNodes,
        ...nodesWithoutParents.filter((n) => !systemNodes.includes(n)),
        ...nodesWithParents,
    ];
}
