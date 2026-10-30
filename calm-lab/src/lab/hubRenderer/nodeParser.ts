// Ported from calm-hub-ui/src/visualizer/components/reactflow/utils/nodeParser.ts (commit c4f983cc).
// Keep logic in sync until the shared renderer package extraction.

import type { Node } from 'reactflow';
import { toDisplayText } from './calmHelpers';
import type { LabCalmNode, LabCalmRelationship, LabContainment } from './types';

/** True if `target` is `from` or one of its ancestors. */
function reaches(parentMap: Map<string, string[]>, from: string, target: string): boolean {
    const seen = new Set<string>();
    const stack = [from];
    while (stack.length > 0) {
        const id = stack.pop()!;
        if (id === target) return true;
        if (seen.has(id)) continue;
        seen.add(id);
        stack.push(...(parentMap.get(id) ?? []));
    }
    return false;
}

/**
 * Identifies container nodes from deployed-in and composed-of relationships.
 * Only containers that are in `nodes` can hold a node.
 *
 * Lab addition (not in the Hub original): the lab parses the live editor
 * buffer, so a containment relationship can name a container that has not been
 * added to `nodes` yet — ReactFlow throws on a `parentId` with no matching
 * node — or close a loop (A in B, B in A), which the layout walks forever.
 */
export interface ContainerInfo {
    containerNodeIds: Set<string>;
    /**
     * Every container of each node, with no cycles. The first is the one each node was drawn in
     * before nodes could have several: the last container that does not close a cycle.
     * The others follow, last relationship first.
     */
    parentMap: Map<string, string[]>;
}

export function identifyContainerNodes(relationships: LabCalmRelationship[], nodes: LabCalmNode[] = []): ContainerInfo {
    const containerNodeIds = new Set<string>();
    const knownNodeIds = new Set(nodes.map((node) => node?.['unique-id']).filter((id): id is string => Boolean(id)));
    const containments: [string, string][] = [];

    relationships.forEach((rel) => {
        const deployedIn: LabContainment | undefined = rel['relationship-type']?.['deployed-in'];
        if (deployedIn) {
            const containerId = deployedIn.container;
            const childNodeIds = deployedIn.nodes || [];
            if (containerId) {
                containerNodeIds.add(containerId);
                childNodeIds.forEach((childId) => {
                    if (childId && knownNodeIds.has(containerId)) containments.push([childId, containerId]);
                });
            }
        }

        const composedOf: LabContainment | undefined = rel['relationship-type']?.['composed-of'];
        if (composedOf) {
            const containerId = composedOf.container;
            const childNodeIds = composedOf.nodes || [];
            if (containerId) {
                containerNodeIds.add(containerId);
                childNodeIds.forEach((childId) => {
                    if (childId && knownNodeIds.has(containerId)) containments.push([childId, containerId]);
                });
            }
        }
    });

    // First the container each node was drawn in before nodes could have several: the last one that
    // does not close a cycle. Then the others, last relationship first, except those that closed a cycle.
    const parentMap = new Map<string, string[]>();
    const closedCycle = new Set<string>();
    for (const [childId, containerId] of containments) {
        if (reaches(parentMap, containerId, childId)) closedCycle.add(`${childId}\u0000${containerId}`);
        else parentMap.set(childId, [containerId]);
    }
    for (const [childId, containerId] of [...containments].reverse()) {
        const parents = parentMap.get(childId) ?? [];
        if (parents.includes(containerId) || closedCycle.has(`${childId}\u0000${containerId}`)) continue;
        if (reaches(parentMap, containerId, childId)) continue;
        parents.push(containerId);
        parentMap.set(childId, parents);
    }

    return { containerNodeIds, parentMap };
}

/**
 * Creates a system/group node from a CALM node
 */
function createSystemNode(node: LabCalmNode, id: string, parentId: string | undefined): Node {
    return {
        id,
        type: 'group',
        position: { x: 0, y: 0 },
        style: { zIndex: -1 },
        data: {
            ...node,
            // After the spread: a literal `"label"` in the document must not
            // put a non-string value in front of React.
            label: toDisplayText(node.name || node['unique-id']),
        },
        ...(parentId && { parentId }),
    };
}

/**
 * Creates a regular custom node from a CALM node
 */
function createRegularNode(node: LabCalmNode, id: string, parentId: string | undefined, onShowDetailsCallback?: (node: LabCalmNode) => void): Node {
    return {
        id,
        type: 'custom',
        position: { x: 0, y: 0 },
        data: {
            ...node,
            onShowDetails: onShowDetailsCallback,
            // After the spread: a literal `"label"` in the document must not
            // put a non-string value in front of React.
            label: toDisplayText(node.name || node['unique-id']),
        },
        ...(parentId && { parentId }),
    };
}

/**
 * Parses CALM nodes into ReactFlow nodes
 */
export interface ParsedNodes {
    regularNodes: Node[];
    systemNodes: Node[];
    /** React Flow ids of each CALM node. More than one when the node is in several containers. */
    instancesOf: Map<string, string[]>;
    /** Container ids enclosing each React Flow node, outermost first. */
    ancestorsOf: Map<string, string[]>;
    /** True when a limit drew each node in its last container only. */
    copiesLimited: boolean;
}

/** Extra drawings, or extra edges to them, above which each node is drawn in its last container only. */
export const MAX_COPIES = 1000;

export function parseNodes(nodes: LabCalmNode[], containerInfo: ContainerInfo, onShowDetailsCallback?: (node: LabCalmNode) => void, drawOnce = false): ParsedNodes {
    const regularNodes: Node[] = [];
    const systemNodes: Node[] = [];
    const { containerNodeIds, parentMap } = containerInfo;

    // A node in several containers is drawn once in each, with everything nested in it.
    // The drawing in the last container keeps the CALM id, as before, so saved positions still apply.
    // Each other drawing is a copy with its own id.
    type Instance = { id: string; parentId?: string; ancestors: string[] };
    const ids = [...new Set(nodes.map((n) => n['unique-id']).filter((id): id is string => Boolean(id)))];
    const takenIds = new Set(ids);
    const copyId = (id: string, parentInstanceId: string) => {
        const base = `${id}__in__${parentInstanceId}`;
        let candidate = base;
        for (let i = 2; takenIds.has(candidate); i++) candidate = `${base}_${i}`;
        takenIds.add(candidate);
        return candidate;
    };
    // A container that is already an ancestor through another container adds no drawing,
    // e.g. a service listed in both its cluster and its namespace
    const parentsOf = new Map(ids.map((id) => {
        const parents = parentMap.get(id) ?? [];
        return [id, parents.filter((p) => !parents.some((q) => q !== p && reaches(parentMap, q, p)))];
    }));

    // Parents before children
    const childrenOf = new Map<string, string[]>();
    for (const [id, parents] of parentsOf) {
        for (const p of parents) {
            const children = childrenOf.get(p) ?? [];
            children.push(id);
            childrenOf.set(p, children);
        }
    }
    const waiting = new Map(ids.map((id) => [id, parentsOf.get(id)!.length]));
    const order = ids.filter((id) => waiting.get(id) === 0);
    for (let i = 0; i < order.length; i++) {
        for (const child of childrenOf.get(order[i]) ?? []) {
            waiting.set(child, waiting.get(child)! - 1);
            if (waiting.get(child) === 0) order.push(child);
        }
    }

    // Copies multiply with each level of shared containers. Past the limit, draw each node in its last container only.
    const drawings = new Map<string, number>();
    for (const id of order) {
        const parents = parentsOf.get(id)!;
        drawings.set(id, parents.length === 0 ? 1 : parents.reduce((sum, p) => sum + drawings.get(p)!, 0));
    }
    const capped = drawOnce || ids.reduce((sum, id) => sum + drawings.get(id)! - 1, 0) > MAX_COPIES;

    const resolved = new Map<string, Instance[]>();
    for (const id of order) {
        const parents = capped ? parentsOf.get(id)!.slice(0, 1) : parentsOf.get(id)!;
        const instances: Instance[] = [];
        for (const p of parents) {
            for (const parent of resolved.get(p)!) {
                const instanceId = instances.length === 0 ? id : copyId(id, parent.id);
                instances.push({ id: instanceId, parentId: parent.id, ancestors: [...parent.ancestors, parent.id] });
            }
        }
        if (instances.length === 0) instances.push({ id, ancestors: [] });
        resolved.set(id, instances);
    }

    const instancesOf = new Map<string, string[]>();
    const ancestorsOf = new Map<string, string[]>();
    nodes.forEach((node) => {
        const id = node['unique-id'];

        if (!id) return;

        const instances = resolved.get(id)!;
        instancesOf.set(id, instances.map((i) => i.id));
        for (const { id: instanceId, parentId, ancestors } of instances) {
            ancestorsOf.set(instanceId, ancestors);
            if (containerNodeIds.has(id)) {
                systemNodes.push(createSystemNode(node, instanceId, parentId));
            } else {
                regularNodes.push(createRegularNode(node, instanceId, parentId, onShowDetailsCallback));
            }
        }
    });

    return { regularNodes, systemNodes, instancesOf, ancestorsOf, copiesLimited: capped };
}
