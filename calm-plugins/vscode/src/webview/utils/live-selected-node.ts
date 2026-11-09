import type { Node } from 'reactflow';
import { calmIdOf } from '../transforms/node-instances';

/** The current drawing of the selected node. A rebuild can change or remove it: then another drawing of the same CALM node. */
export function resolveLiveSelectedNode(selectedNode: Node | null, nodes: Node[]): Node | null {
    if (!selectedNode) return null;
    return nodes.find((n) => n.id === selectedNode.id) ?? nodes.find((n) => calmIdOf(n) === calmIdOf(selectedNode)) ?? null;
}
