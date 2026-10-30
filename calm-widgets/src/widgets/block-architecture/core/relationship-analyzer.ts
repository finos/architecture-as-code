import {
    CalmRelationshipCanonicalModel,
    isComposedOf,
    isDeployedIn,
} from '@finos/calm-models/canonical';

export interface ParentHierarchyResult {
    /** All parents of each node, in the order they were first seen. A node is drawn once in each. */
    parentsOf: Map<string, string[]>;
    allMentionedContainers: Set<string>;
    childrenOfContainer: Map<string, Set<string>>;
}

/**
 * True if making `container` a parent of `child` would create a cycle,
 * i.e. `child` is already `container` or one of its ancestors.
 */
function createsCycle(parentsOf: Map<string, string[]>, container: string, child: string): boolean {
    const stack = [container];
    const visited = new Set<string>();
    while (stack.length > 0) {
        const cur = stack.pop()!;
        if (cur === child) return true;
        if (visited.has(cur)) continue;
        visited.add(cur);
        stack.push(...(parentsOf.get(cur) ?? []));
    }
    return false;
}

function addTo(map: Map<string, string[]>, key: string, value: string): void {
    const existing = map.get(key);
    if (!existing) map.set(key, [value]);
    else if (!existing.includes(value)) existing.push(value);
}

/**
 * Analyzes all relationships to build parent-child hierarchies for container structures.
 * Handles both composed-of and deployed-in relationships and rejects parents that would create cycles.
 *
 * A node can have several parents, e.g. a namespace deployed in several clusters.
 * When both composition and deployment exist for the same node, composition takes
 * precedence for the node placement, and composed containers are nested under
 * deployed containers when possible.
 */
export function buildParentHierarchy(relationships: CalmRelationshipCanonicalModel[]): ParentHierarchyResult {
    const parentsOf = new Map<string, string[]>();
    const allMentionedContainers = new Set<string>();
    const childrenOfContainer = new Map<string, Set<string>>();

    const composedParents = new Map<string, string[]>();
    const deployedParents = new Map<string, string[]>();

    for (const rel of relationships) {
        const rt = rel['relationship-type'];
        const entry = isComposedOf(rt)
            ? { container: rt['composed-of'].container, nodes: rt['composed-of'].nodes, parents: composedParents }
            : isDeployedIn(rt)
                ? { container: rt['deployed-in'].container, nodes: rt['deployed-in'].nodes, parents: deployedParents }
                : undefined;
        if (!entry) continue;

        allMentionedContainers.add(entry.container);
        const existing = childrenOfContainer.get(entry.container) || new Set<string>();
        for (const child of entry.nodes || []) {
            existing.add(child);
            addTo(entry.parents, child, entry.container);
        }
        childrenOfContainer.set(entry.container, existing);
    }

    // Nest a composed container under the deployed container of its members.
    // This parent is inferred, so it is a single parent and never makes copies.
    for (const [node, composed] of composedParents.entries()) {
        const C = composed[0];
        const D = deployedParents.get(node)?.[0];
        if (D && C !== D && !createsCycle(parentsOf, D, C)) parentsOf.set(C, [D]);
    }

    // A node's own parents replace an inferred one; composed-of wins over deployed-in
    const acceptable = (id: string, parents: string[] = []) => parents.filter(p => !createsCycle(parentsOf, p, id));
    for (const id of new Set([...composedParents.keys(), ...deployedParents.keys()])) {
        const composed = acceptable(id, composedParents.get(id));
        const own = composed.length > 0 ? composed : acceptable(id, deployedParents.get(id));
        if (own.length > 0) parentsOf.set(id, own);
    }

    // A parent that is already an ancestor through another parent adds no drawing,
    // e.g. a service listed in both its cluster and its namespace
    const isAncestor = (a: string, of: string) => createsCycle(parentsOf, of, a);
    for (const [id, parents] of parentsOf.entries()) {
        if (parents.length > 1) parentsOf.set(id, parents.filter(p => !parents.some(q => q !== p && isAncestor(p, q))));
    }

    return { parentsOf, allMentionedContainers, childrenOfContainer };
}
