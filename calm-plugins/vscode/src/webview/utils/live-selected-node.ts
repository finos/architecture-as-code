import type { Node } from 'reactflow';
import { calmIdOf, pathOf } from '../transforms/node-instances';

/**
 * The current drawing of the selected node: the drawing at the place it was selected, else the drawing with its id,
 * else another drawing of the same CALM node.
 */
export function resolveLiveSelectedNode(selectedNode: Node | null, nodes: Node[], place: string | null): Node | null {
    if (!selectedNode) return null;
    const drawings = nodes.filter((n) => calmIdOf(n) === calmIdOf(selectedNode));
    const byId = new Map(nodes.map((n) => [n.id, n]));
    return (place !== null ? drawings.find((n) => pathOf(n, byId) === place) : undefined)
        ?? byId.get(selectedNode.id)
        ?? drawings[0]
        ?? null;
}
