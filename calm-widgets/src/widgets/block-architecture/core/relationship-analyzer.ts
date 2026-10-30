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
    /** Parents that are not drawn */
    warnings: string[];
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
    const warnings: string[] = [];

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
        const [D, ...others] = deployedParents.get(node) ?? [];
        if (D && C !== D && !createsCycle(parentsOf, D, C)) parentsOf.set(C, [D]);
        for (const other of others) {
            warnings.push(`Node "${node}" has multiple deployed-in parents: "${D}" vs "${other}" (keeping "${D}")`);
        }
    }

    // First the parent each node had before nodes could have several: its first composed-of container,
    // else its first deployed-in container, unless that closes a cycle. It replaces an inferred parent.
    const ownParents = new Map<string, string[]>();
    for (const id of new Set([...composedParents.keys(), ...deployedParents.keys()])) {
        const composed = composedParents.get(id);
        const deployed = deployedParents.get(id);
        if (composed && !createsCycle(parentsOf, composed[0], id)) ownParents.set(id, composed);
        else if (deployed && !createsCycle(parentsOf, deployed[0], id)) ownParents.set(id, deployed);
        else continue;
        parentsOf.set(id, [ownParents.get(id)![0]]);
    }

    // Then its other parents of the same kind, unless they close a cycle
    for (const [id, parents] of ownParents) {
        for (const p of parents.slice(1)) {
            if (!createsCycle(parentsOf, p, id)) parentsOf.get(id)!.push(p);
        }
    }

    return { parentsOf, allMentionedContainers, childrenOfContainer, warnings };
}
