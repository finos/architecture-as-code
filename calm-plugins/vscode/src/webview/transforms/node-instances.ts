import type { Node, Edge } from 'reactflow';

// A CALM node in several containers is drawn once per container. All drawings share data.calmId.
const calmIdOf = (n: Node): string => ((n.data as Record<string, unknown> | undefined)?.calmId as string) ?? n.id;

/** Applies `update` to every drawing of the CALM node drawn as `nodeId`. */
export function updateInstances(nodes: Node[], nodeId: string, update: (n: Node) => Node): Node[] {
    const target = nodes.find((n) => n.id === nodeId);
    if (!target) return nodes;
    const calmId = calmIdOf(target);
    return nodes.map((n) => (calmIdOf(n) === calmId ? update(n) : n));
}

/**
 * Moves the edges of deleted drawings to a remaining drawing of the same CALM node,
 * so that deleting one drawing removes only that container membership.
 */
export function reattachEdges(edges: Edge[], deletedNodes: Node[], remainingNodes: Node[]): Edge[] {
    const replacement = new Map<string, string | undefined>();
    for (const deleted of deletedNodes) {
        replacement.set(deleted.id, remainingNodes.find((n) => calmIdOf(n) === calmIdOf(deleted))?.id);
    }
    const endpoint = (id: string) => (replacement.has(id) ? replacement.get(id) : id);
    return edges.flatMap((e) => {
        const source = endpoint(e.source);
        const target = endpoint(e.target);
        if (!source || !target) return [];
        return source === e.source && target === e.target ? [e] : [{ ...e, source, target }];
    });
}
