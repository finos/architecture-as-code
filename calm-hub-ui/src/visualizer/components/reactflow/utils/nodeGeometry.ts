/**
 * React Flow 12 stores measured size on `node.measured` and the absolute
 * position on `node.internals.positionAbsolute`. v11 put both on the node
 * itself. These helpers read either shape so layout, edges and callouts work
 * with InternalNode values from the store and with plain Node fixtures in tests.
 */
export type NodeGeometrySource = {
    id: string;
    type?: string;
    width?: number | null;
    height?: number | null;
    measured?: { width?: number; height?: number };
    positionAbsolute?: { x: number; y: number };
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
    return numeric(node.measured?.width) ?? numeric(node.width) ?? numeric(node.style?.width);
}

export function nodeHeight(node: NodeGeometrySource): number | undefined {
    return numeric(node.measured?.height) ?? numeric(node.height) ?? numeric(node.style?.height);
}

export function nodePositionAbsolute(node: NodeGeometrySource): { x: number; y: number } | undefined {
    return node.internals?.positionAbsolute ?? node.positionAbsolute;
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
