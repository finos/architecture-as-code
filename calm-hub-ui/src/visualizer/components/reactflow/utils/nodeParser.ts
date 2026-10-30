import { Node } from 'reactflow';
import { CalmNodeSchema, CalmRelationshipSchema } from '@finos/calm-models/types';

/**
 * Container information extracted from relationships
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
 */
export function identifyContainerNodes(relationships: CalmRelationshipSchema[], nodes: CalmNodeSchema[]): ContainerInfo {
    const containerNodeIds = new Set<string>();
    const knownNodeIds = new Set(nodes.map((node) => node['unique-id']));
    const containments: [string, string][] = [];

    relationships.forEach((rel) => {
        const deployedIn = rel['relationship-type']?.['deployed-in'];
        if (deployedIn) {
            const containerId = deployedIn.container;
            const childNodeIds = deployedIn.nodes || [];
            if (containerId) {
                containerNodeIds.add(containerId);
                childNodeIds.forEach((childId: string) => {
                    if (knownNodeIds.has(containerId)) containments.push([childId, containerId]);
                });
            }
        }

        const composedOf = rel['relationship-type']?.['composed-of'];
        if (composedOf) {
            const containerId = composedOf.container;
            const childNodeIds = composedOf.nodes || [];
            if (containerId) {
                containerNodeIds.add(containerId);
                childNodeIds.forEach((childId: string) => {
                    if (knownNodeIds.has(containerId)) containments.push([childId, containerId]);
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
function createSystemNode(
    node: CalmNodeSchema,
    id: string,
    parentId: string | undefined
): Node {
    return {
        id,
        type: 'group',
        position: { x: 0, y: 0 },
        style: { zIndex: -1 },
        data: {
            label: node.name || node['unique-id'],
            ...node,
        },
        ...(parentId && { parentId }),
    };
}

/**
 * Creates a regular custom node from a CALM node
 */
function createRegularNode(
    node: CalmNodeSchema,
    id: string,
    parentId: string | undefined,
    onShowDetailsCallback?: (nodeData: CalmNodeSchema) => void
): Node {
    return {
        id,
        type: 'custom',
        position: { x: 0, y: 0 },
        data: {
            label: node.name || node['unique-id'],
            ...node,
            onShowDetails: onShowDetailsCallback,
        },
        ...(parentId && { parentId }),
    };
}

/**
 * Result of parsing nodes
 */
export interface ParsedNodes {
    regularNodes: Node[];
    systemNodes: Node[];
    /** React Flow ids of each CALM node. More than one when the node is in several containers. */
    instancesOf: Map<string, string[]>;
    /** Container ids enclosing each React Flow node, outermost first. */
    ancestorsOf: Map<string, string[]>;
}

/** Copies above which a node in several containers is drawn in its last container only. */
const MAX_COPIES = 1000;

/**
 * Parses CALM nodes into ReactFlow nodes
 */
export function parseNodes(
    nodes: CalmNodeSchema[],
    containerInfo: ContainerInfo,
    onShowDetailsCallback?: (nodeData: CalmNodeSchema) => void
): ParsedNodes {
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
    const capped = ids.reduce((sum, id) => sum + drawings.get(id)! - 1, 0) > MAX_COPIES;

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

    return { regularNodes, systemNodes, instancesOf, ancestorsOf };
}
