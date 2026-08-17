import type { Node } from 'reactflow';

export function makeContainment(parentId: string, childId: string, nodes: Node[]): Node[] {
    let depth = 1;
    let currentId: string | undefined = parentId;
    while (currentId) {
        const parent = nodes.find((n) => n.id === currentId);
        if (parent?.parentId) {
            depth++;
            currentId = parent.parentId as string;
        } else {
            break;
        }
    }

    return nodes.map((node) => {
        if (node.id === parentId && node.type !== 'container') {
            return { ...node, type: 'container', width: (node as any).width ?? 400, height: (node as any).height ?? 300 };
        }
        if (node.id === childId) {
            const parentNode = nodes.find((n) => n.id === parentId);
            const parentPos = getAbsolutePosition(parentNode!, nodes);
            const childAbsPos = getAbsolutePosition(node, nodes);
            const relativePos = {
                x: childAbsPos.x - parentPos.x,
                y: childAbsPos.y - parentPos.y,
            };
            return { ...node, parentId, extent: 'parent' as const, zIndex: depth, position: relativePos };
        }
        return node;
    });
}

export function removeContainment(childId: string, nodes: Node[]): Node[] {
    const child = nodes.find((n) => n.id === childId);
    if (!child || !child.parentId) return nodes;

    const absolutePos = getAbsolutePosition(child, nodes);

    return nodes.map((node) => {
        if (node.id !== childId) return node;
        const { parentId: _pid, extent: _ext, zIndex: _z, ...rest } = node as any;
        return { ...rest, position: absolutePos } as Node;
    });
}

export function isInsideBounds(
    point: { x: number; y: number },
    bounds: { x: number; y: number; width: number; height: number },
): boolean {
    return point.x >= bounds.x && point.x <= bounds.x + bounds.width
        && point.y >= bounds.y && point.y <= bounds.y + bounds.height;
}

export function getAbsolutePosition(node: Node, allNodes: Node[]): { x: number; y: number } {
    let x = node.position.x;
    let y = node.position.y;
    let current = node;
    while (current.parentId) {
        const parent = allNodes.find((n) => n.id === current.parentId);
        if (!parent) break;
        x += parent.position.x;
        y += parent.position.y;
        current = parent;
    }
    return { x, y };
}
