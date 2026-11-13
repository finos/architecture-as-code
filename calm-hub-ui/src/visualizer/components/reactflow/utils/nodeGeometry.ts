/**
 * React Flow 12 stores measured size on `node.measured` and the absolute
 * position on `node.internals.positionAbsolute`. These helpers read that
 * shape so layout, edges and callouts work with InternalNode values from the store.
 */
export type NodeGeometrySource = {
    id: string;
    type?: string;
    measured?: { width?: number; height?: number };
    internals?: { positionAbsolute?: { x: number; y: number } };
    style?: { width?: number | string; height?: number | string; opacity?: number | string };
};

export type NodeGeometry = {
    id: string;
    type?: string;
    width?: number;
    height?: number;
    positionAbsolute?: { x: number; y: number };
};

function numeric(value: number | string | null | undefined): number | undefined {
    return typeof value === 'number' ? value : undefined;
}

export function nodeWidth(node: NodeGeometrySource): number | undefined {
    return numeric(node.measured?.width);
}

export function nodeHeight(node: NodeGeometrySource): number | undefined {
    return numeric(node.measured?.height);
}

export function nodePositionAbsolute(node: NodeGeometrySource): { x: number; y: number } | undefined {
    return node.internals?.positionAbsolute;
}

export function nodeGeometry(node: NodeGeometrySource | undefined): NodeGeometry | undefined {
    if (!node) return undefined;
    return {
        id: node.id,
        type: node.type,
        width: nodeWidth(node),
        height: nodeHeight(node),
        positionAbsolute: nodePositionAbsolute(node),
    };
}
