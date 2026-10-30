import type { Node, Edge } from 'reactflow';

// A CALM node in several containers is drawn once per container. All drawings share data.calmId.
export const calmIdOf = (n: Node): string => ((n.data as Record<string, unknown> | undefined)?.calmId as string) ?? n.id;

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

/**
 * Other drawings of the same container membership as `node`: the same CALM node in another
 * drawing of the same container. The file holds the membership once, so an edit to it applies to all.
 */
export function sameMembership(node: Node, nodes: Node[]): Node[] {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const containerOf = (n: Node) => {
        const parent = n.parentId ? byId.get(n.parentId) : undefined;
        return parent ? calmIdOf(parent) : n.parentId;
    };
    const container = containerOf(node);
    if (!container) return [];
    return nodes.filter((n) => n.id !== node.id && calmIdOf(n) === calmIdOf(node) && containerOf(n) === container);
}

/** `ids` and every drawing nested in them. */
export function withDescendants(ids: Set<string>, nodes: Node[]): Set<string> {
    const result = new Set(ids);
    let grew = true;
    while (grew) {
        grew = false;
        for (const n of nodes) {
            if (n.parentId && result.has(n.parentId) && !result.has(n.id)) {
                result.add(n.id);
                grew = true;
            }
        }
    }
    return result;
}

/** True when a node has several drawings, or a membership that is not drawn (data.otherParents). */
export function hasSharedDrawings(nodes: Node[]): boolean {
    const seen = new Set<string>();
    for (const n of nodes) {
        if ((((n.data as Record<string, unknown> | undefined)?.otherParents as string[] | undefined) ?? []).length > 0) return true;
        if (seen.has(calmIdOf(n))) return true;
        seen.add(calmIdOf(n));
    }
    return false;
}
