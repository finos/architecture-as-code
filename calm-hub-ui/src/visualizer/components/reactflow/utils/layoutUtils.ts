import { Node, Edge } from 'reactflow';
import dagre from '@dagrejs/dagre';
import { GRAPH_LAYOUT } from './constants';

/**
 * Applies Dagre layout to nodes and edges
 */
export function getLayoutedElements(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    const nodeWidth = GRAPH_LAYOUT.NODE_WIDTH;
    const nodeHeight = GRAPH_LAYOUT.NODE_HEIGHT;

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
        dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
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
                x: nodeWithPosition.x - nodeWidth / 2,
                y: nodeWithPosition.y - nodeHeight / 2,
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
        const width = (node.style?.width as number) || GRAPH_LAYOUT.NODE_WIDTH;
        const height = (node.style?.height as number) || GRAPH_LAYOUT.NODE_HEIGHT;
        dagreGraph.setNode(node.id, { width, height });
    });

    topLevelEdges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const positions = new Map<string, { x: number; y: number }>();
    topLevelNodes.forEach((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        const width = (node.style?.width as number) || GRAPH_LAYOUT.NODE_WIDTH;
        const height = (node.style?.height as number) || GRAPH_LAYOUT.NODE_HEIGHT;
        positions.set(node.id, {
            x: nodeWithPosition.x - width / 2,
            y: nodeWithPosition.y - height / 2,
        });
    });

    return positions;
}
