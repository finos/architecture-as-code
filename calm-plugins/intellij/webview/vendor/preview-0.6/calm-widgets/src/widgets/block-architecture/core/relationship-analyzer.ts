import {
    CalmRelationshipCanonicalModel,
    isComposedOf,
    isDeployedIn,
} from '@finos/calm-models/canonical';

export interface ParentHierarchyResult {
    parentOf: Map<string, string>;
    allMentionedContainers: Set<string>;
    childrenOfContainer: Map<string, Set<string>>;
    warnings: string[];
}

/**
 * True if setting `child`'s parent to `container` would create a cycle.
 * Walks up the existing parent chain from `container` and:
 *  - returns true if we encounter `child`
 *  - bails out (true) if it detects an existing cycle in the chain
 */
function createsCycle(parentOf: Map<string, string>, container: string, child: string): boolean {
    if (container === child) return true;
    let cur: string | undefined = container;
    const visited = new Set<string>();

    while (cur) {
        if (cur === child) return true;        // would create a cycle
        if (visited.has(cur)) return true;     // existing cycle detected → unsafe
        visited.add(cur);
        cur = parentOf.get(cur);
    }
    return false; // reached a root safely
}

/**
 * Analyzes all relationships to build parent-child hierarchies for container structures.
 * Handles both composed-of and deployed-in relationships, resolving conflicts and
 * creating a unified hierarchy while detecting cycles and tracking warnings.
 *
 * When both composition and deployment exist for the same node, composition takes
 * precedence for the node placement, and composed containers are nested under
 * deployed containers when possible.
 */
export function buildParentHierarchy(relationships: CalmRelationshipCanonicalModel[]): ParentHierarchyResult {
    const warnings: string[] = [];
    const parentOf = new Map<string, string>();
    const allMentionedContainers = new Set<string>();
    const childrenOfContainer = new Map<string, Set<string>>();

    const composedParent = new Map<string, string>();
    const deployedParent = new Map<string, string>();

    for (const rel of relationships) {
        const rt = rel['relationship-type'];
        if (isComposedOf(rt)) {
            const C = rt['composed-of'].container;
            allMentionedContainers.add(C);
            const kids = new Set(rt['composed-of'].nodes || []);
            const existing = childrenOfContainer.get(C) || new Set<string>();
            for (const k of kids) existing.add(k);
            childrenOfContainer.set(C, existing);

            for (const child of kids) {
                const prev = composedParent.get(child);
                if (prev && prev !== C)
                    warnings.push(`Node "${child}" has multiple composed-of parents: "${prev}" vs "${C}" (keeping "${prev}")`);
                else composedParent.set(child, C);
            }
        }
        if (isDeployedIn(rt)) {
            const D = rt['deployed-in'].container;
            allMentionedContainers.add(D);
            const kids = new Set(rt['deployed-in'].nodes || []);
            const existing = childrenOfContainer.get(D) || new Set<string>();
            for (const k of kids) existing.add(k);
            childrenOfContainer.set(D, existing);

            for (const child of kids) {
                const prev = deployedParent.get(child);
                if (prev && prev !== D)
                    warnings.push(`Node "${child}" has multiple deployed-in parents: "${prev}" vs "${D}" (keeping "${prev}")`);
                else deployedParent.set(child, D);
            }
        }
    }

    // Nest composed-container under deployed-container when both exist for the same node
    for (const [node, C] of composedParent.entries()) {
        const D = deployedParent.get(node);
        if (C && D && C !== D) {
            if (!createsCycle(parentOf, D, C)) parentOf.set(C, D);
        }
    }

    // Assign node under composed or deployed parent
    for (const node of new Set([...composedParent.keys(), ...deployedParent.keys()])) {
        const C = composedParent.get(node);
        const D = deployedParent.get(node);
        if (C && !createsCycle(parentOf, C, node)) parentOf.set(node, C);
        else if (D && !createsCycle(parentOf, D, node)) parentOf.set(node, D);
    }

    return { parentOf, allMentionedContainers, childrenOfContainer, warnings };
}
