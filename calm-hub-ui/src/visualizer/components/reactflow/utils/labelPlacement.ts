interface PlacedNode {
    id: string;
    type?: string;
    width?: number | null;
    height?: number | null;
    positionAbsolute?: { x: number; y: number };
}

/**
 * The top edge of the node an edge label at (x, y) would cover, or undefined when it covers none. Only drawn nodes
 * count, not the group containers around them, and not the edge's own ends. Presentation mode lifts a label above
 * such a node, so the larger label does not hide the node's own label.
 */
export function coveredNodeTop(
    nodes: Iterable<PlacedNode>,
    x: number,
    y: number,
    ends: string[],
): number | undefined {
    for (const node of nodes) {
        if (node.type !== 'custom' || ends.includes(node.id)) continue;
        const { positionAbsolute: p, width, height } = node;
        if (!p || !width || !height) continue;
        if (x >= p.x && x <= p.x + width && y >= p.y && y <= p.y + height) return p.y;
    }
    return undefined;
}
