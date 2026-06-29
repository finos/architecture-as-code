import dagre from '@dagrejs/dagre';
import { Position, type Node, type Edge } from '@xyflow/react';

const NODE_WIDTH = 200;
const NODE_HEIGHT = 80;
const BOUNDARY_PADDING = 40;

/**
 * Apply dagre hierarchical auto-layout to React Flow nodes and edges.
 *
 * Trust boundary parent nodes are excluded from dagre processing — they
 * have their bounds computed from their children's positions after layout.
 *
 * @param nodes - React Flow nodes array (parents must appear before children)
 * @param edges - React Flow edges array
 * @param direction - Layout direction: 'LR' (left-to-right) or 'TB' (top-bottom)
 * @returns Layouted nodes and edges with updated position values
 */
export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction: 'LR' | 'TB' = 'LR'
): { nodes: Node[]; edges: Edge[] } {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: direction, ranksep: 180, nodesep: 80 });

  // Separate trust boundary parents from child nodes
  const parentNodes = nodes.filter((n) => n.type === 'trustBoundary');
  const childNodes = nodes.filter((n) => n.type !== 'trustBoundary');
  const parentIds = new Set(parentNodes.map((n) => n.id));

  // Only add non-parent nodes to dagre (children participate in edge layout)
  childNodes.forEach((node) => {
    graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  // Only add edges between non-parent nodes
  edges.forEach((edge) => {
    if (!parentIds.has(edge.source) && !parentIds.has(edge.target)) {
      graph.setEdge(edge.source, edge.target);
    }
  });

  dagre.layout(graph);

  // Apply dagre positions to child nodes
  const layoutedChildren = childNodes.map((node) => {
    const nodeWithPosition = graph.node(node.id);

    // Dagre may not have positions for nodes with no edges
    if (!nodeWithPosition) {
      return {
        ...node,
        targetPosition: Position.Left,
        sourcePosition: Position.Right,
      };
    }

    return {
      ...node,
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });

  // Compute trust boundary parent bounds from their children's positions
  const layoutedParents = parentNodes.map((parentNode) => {
    const children = layoutedChildren.filter((n) => n.parentId === parentNode.id);

    if (children.length === 0) {
      // No children — use a sensible default size
      return {
        ...parentNode,
        position: { x: 0, y: 0 },
        style: {
          ...parentNode.style,
          width: NODE_WIDTH + BOUNDARY_PADDING * 2,
          height: NODE_HEIGHT + BOUNDARY_PADDING * 2,
        },
      };
    }

    // Compute bounding box of children
    const minX = Math.min(...children.map((c) => c.position.x));
    const minY = Math.min(...children.map((c) => c.position.y));
    const maxX = Math.max(...children.map((c) => c.position.x + NODE_WIDTH));
    const maxY = Math.max(...children.map((c) => c.position.y + NODE_HEIGHT));

    const parentX = minX - BOUNDARY_PADDING;
    const parentY = minY - BOUNDARY_PADDING - 24; // Extra top space for label

    return {
      ...parentNode,
      position: { x: parentX, y: parentY },
      style: {
        ...parentNode.style,
        width: maxX - minX + BOUNDARY_PADDING * 2,
        height: maxY - minY + BOUNDARY_PADDING * 2 + 24,
      },
    };
  });

  // Adjust children positions to be relative to parent if they have a parentId
  const adjustedChildren = layoutedChildren.map((node) => {
    if (!node.parentId) return node;

    const parent = layoutedParents.find((p) => p.id === node.parentId);
    if (!parent) return node;

    return {
      ...node,
      position: {
        x: node.position.x - parent.position.x,
        y: node.position.y - parent.position.y,
      },
    };
  });

  // CRITICAL: Parent nodes must appear before children in the array (React Flow requirement)
  const orderedNodes = [...layoutedParents, ...adjustedChildren];

  return { nodes: orderedNodes, edges };
}
