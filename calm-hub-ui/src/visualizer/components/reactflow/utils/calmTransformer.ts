import { Node, Edge } from 'reactflow';
import { CalmArchitectureSchema, CalmNodeSchema, CalmRelationshipSchema } from '@finos/calm-models/types';
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

        const result = applyLayout(regularNodes, systemNodes, edges);

        return applyFlowStyling(result, relationships);
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
    return sortNodesParentsBeforeChildren([
        ...topLevelSystemNodes,
        ...nodesWithoutParents.filter((n) => !systemNodes.includes(n)),
        ...nodesWithParents,
    ]);
}

/**
 * Explicit per-element flow-animation state. Set by the flow architecture view
 * and consumed here to drive styling. State is passed explicitly rather than
 * inferred from opacity, so opacity stays a purely visual concern.
 */
export type FlowVizState = 'active' | 'visited' | 'in-flow' | 'dimmed';

/** A relationship augmented with the flow-animation fields the overlay adds. */
type FlowStyledRelationship = CalmRelationshipSchema & {
    'flow-opacity'?: number;
    'flow-state'?: FlowVizState;
    'flow-active-direction'?: string;
};

// Non-matching direction of a bidirectional edge is dimmed to this opacity.
const DIMMED_DIRECTION_OPACITY = 0.15;
const OPACITY_TRANSITION = 'opacity 0.4s ease';

/** CALM's default transition direction, used when a transition omits one. */
export const FORWARD_DIRECTION = 'source-to-destination';

/**
 * Applies flow-animation styling when the source CALM data carries a `flow-state`
 * on its nodes/relationships, to highlight the active step and dim the rest.
 *
 * Direction-aware: bidirectional relationships produce a forward and a backward
 * edge, so the active step's direction decides which of the two is highlighted.
 */
function applyFlowStyling(
    result: ParsedCALMData,
    relationships: FlowStyledRelationship[]
): ParsedCALMData {
    const hasFlowState = result.nodes.some(n => n.data?.['flow-state'] !== undefined);
    if (!hasFlowState) return result;

    const relMeta = new Map<string, { opacity: number; state: FlowVizState; activeDirection?: string }>();
    relationships.forEach((r) => {
        const state = r['flow-state'];
        if (state !== undefined) {
            relMeta.set(r['unique-id'] ?? '', {
                opacity: r['flow-opacity'] ?? 1,
                state,
                activeDirection: r['flow-active-direction'],
            });
        }
    });

    const nodes = result.nodes.map(n => {
        const state = n.data?.['flow-state'] as FlowVizState | undefined;
        if (state === undefined) return n;
        const opacity = (n.data?.['flow-opacity'] as number | undefined) ?? 1;
        const isActive = state === 'active';
        const isVisited = state === 'visited';
        return {
            ...n,
            className: [n.className, isActive ? 'flow-node-active' : isVisited ? 'flow-node-visited' : ''].filter(Boolean).join(' ') || undefined,
            data: { ...n.data, flowActive: isActive, flowVisited: isVisited },
            style: {
                ...n.style,
                opacity,
                transition: OPACITY_TRANSITION,
            },
        };
    });

    const edges = result.edges.map(e => {
        const relId = e.data?.['unique-id'] ?? e.id;
        const meta = relMeta.get(relId);
        if (!meta) return e;

        let opacity = meta.opacity;
        let state = meta.state;

        const edgeDirection = e.data?.direction;
        if (edgeDirection && meta.activeDirection && state === 'active') {
            const edgeIsForward = edgeDirection === 'forward';
            const stepIsForward = meta.activeDirection === FORWARD_DIRECTION;
            if (edgeIsForward !== stepIsForward) {
                opacity = Math.min(opacity, DIMMED_DIRECTION_OPACITY);
                state = 'dimmed';
            }
        }

        const isActive = state === 'active';
        const isVisited = state === 'visited';

        return {
            ...e,
            className: isActive ? 'flow-edge-active' : isVisited ? 'flow-edge-visited' : undefined,
            data: { ...e.data, flowActive: isActive, flowVisited: isVisited },
            style: {
                ...e.style,
                opacity,
                transition: OPACITY_TRANSITION,
            },
        };
    });

    return { nodes, edges };
}
