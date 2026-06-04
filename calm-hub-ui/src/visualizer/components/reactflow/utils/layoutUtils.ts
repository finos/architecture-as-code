import { Node, Edge } from 'reactflow';
import dagre from '@dagrejs/dagre';
import { GRAPH_LAYOUT } from './constants';

/**
 * Returns the effective width of a node, preferring an explicitly computed
 * dimension (set when a node is a sized container) over the standard default.
 * This lets nested container nodes be laid out at their true size rather than
 * being treated as a standard 250x100 node.
 */
export function getNodeWidth(node: Node): number {
    return (node.width as number) ?? (node.style?.width as number) ?? GRAPH_LAYOUT.NODE_WIDTH;
}

/**
 * Returns the effective height of a node (see {@link getNodeWidth}).
 */
export function getNodeHeight(node: Node): number {
    return (node.height as number) ?? (node.style?.height as number) ?? GRAPH_LAYOUT.NODE_HEIGHT;
}

/**
 * Orders container nodes so that the most deeply nested containers come first.
 * Containers must be laid out (and therefore sized) bottom-up: an outer
 * container can only be sized correctly once its inner container children
 * already know their own dimensions.
 */
export function sortContainersDeepestFirst(containers: Node[]): Node[] {
    const byId = new Map(containers.map((c) => [c.id, c]));

    const depth = (node: Node): number => {
        let d = 0;
        let current: Node | undefined = node;
        const seen = new Set<string>();
        while (current?.parentId && byId.has(current.parentId) && !seen.has(current.id)) {
            seen.add(current.id);
            d++;
            current = byId.get(current.parentId);
        }
        return d;
    };

    return [...containers].sort((a, b) => depth(b) - depth(a));
}

/**
 * Calculates the bounding box of child nodes, respecting each child's actual
 * dimensions so that nested container children are fully enclosed.
 */
export function calculateChildBounds(children: Node[]): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
} {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    children.forEach((child) => {
        minX = Math.min(minX, child.position.x);
        minY = Math.min(minY, child.position.y);
        maxX = Math.max(maxX, child.position.x + getNodeWidth(child));
        maxY = Math.max(maxY, child.position.y + getNodeHeight(child));
    });

    return { minX, minY, maxX, maxY };
}

/**
 * Applies Dagre layout to nodes and edges
 */
export function getLayoutedElements(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    dagreGraph.setGraph({
        rankdir: 'LR',
        ranksep: GRAPH_LAYOUT.RANK_SEPARATION,
        nodesep: GRAPH_LAYOUT.NODE_SEPARATION,
        edgesep: GRAPH_LAYOUT.EDGE_SEPARATION,
        marginx: GRAPH_LAYOUT.MARGIN_X,
        marginy: GRAPH_LAYOUT.MARGIN_Y,
        ranker: 'longest-path',
    });

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: getNodeWidth(node), height: getNodeHeight(node) });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const layoutedNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        return {
            ...node,
            position: {
                x: nodeWithPosition.x - getNodeWidth(node) / 2,
                y: nodeWithPosition.y - getNodeHeight(node) / 2,
            },
        };
    });

    return { nodes: layoutedNodes, edges };
}

/**
 * Creates a top-level layout for nodes including system nodes
 */
export function createTopLevelLayout(
    topLevelNodes: Node[],
    topLevelEdges: Edge[]
): Map<string, { x: number; y: number }> {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({
        rankdir: 'LR',
        ranksep: GRAPH_LAYOUT.TOP_LEVEL_RANK_SEPARATION,
        nodesep: GRAPH_LAYOUT.TOP_LEVEL_NODE_SEPARATION,
        edgesep: GRAPH_LAYOUT.TOP_LEVEL_EDGE_SEPARATION,
        marginx: GRAPH_LAYOUT.TOP_LEVEL_MARGIN,
        marginy: GRAPH_LAYOUT.TOP_LEVEL_MARGIN,
    });

    topLevelNodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: getNodeWidth(node), height: getNodeHeight(node) });
    });

    topLevelEdges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const positions = new Map<string, { x: number; y: number }>();
    topLevelNodes.forEach((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        positions.set(node.id, {
            x: nodeWithPosition.x - getNodeWidth(node) / 2,
            y: nodeWithPosition.y - getNodeHeight(node) / 2,
        });
    });

    return positions;
}

/**
 * Calculate the minimum bounds for a group node based on its children.
 * Used by both ArchitectureGraph and PatternGraph to resize groups after drag.
 */
export function calculateGroupBounds(
    groupId: string,
    allNodes: Node[]
): { width: number; height: number } | null {
    const children = allNodes.filter((n) => n.parentId === groupId);
    if (children.length === 0) return null;

    const padding = GRAPH_LAYOUT.SYSTEM_NODE_PADDING;

    let maxX = -Infinity;
    let maxY = -Infinity;

    children.forEach((child) => {
        const childRight = child.position.x + getNodeWidth(child);
        const childBottom = child.position.y + getNodeHeight(child);
        maxX = Math.max(maxX, childRight);
        maxY = Math.max(maxY, childBottom);
    });

    return {
        width: maxX + padding,
        height: maxY + padding,
    };
}
