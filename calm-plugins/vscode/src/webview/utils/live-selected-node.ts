import type { Node } from 'reactflow';
import { calmIdOf, pathOf } from '../transforms/node-instances';

/**
 * The current drawing of the selected node: the drawing at the place it was selected, else the drawing with its id,
 * else another drawing of the same CALM node.
 */
export function resolveLiveSelectedNode(selectedNode: Node | null, nodes: Node[], place: string | null = null): Node | null {
    if (!selectedNode) return null;
    const byId = new Map(nodes.map((n) => [n.id, n]));
    return (place !== null ? nodes.find((n) => pathOf(n, byId) === place) : undefined)
        ?? byId.get(selectedNode.id)
        ?? nodes.find((n) => calmIdOf(n) === calmIdOf(selectedNode))
        ?? null;
}
