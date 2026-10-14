import type { Node } from 'reactflow';

/** Containers are drawn as an outline in the minimap, so the nodes inside them stay visible. */
export function minimapNodeClassName(node: Node): string {
    return node.type === 'container' ? 'calm-minimap-container' : '';
}
