// Ported from calm-hub-ui/src/visualizer/components/reactflow/utils/nodeParser.ts (commit c4f983cc).
// Keep logic in sync until the shared renderer package extraction.

import type { Node } from 'reactflow';
import { toDisplayText } from './calmHelpers';
import type { LabCalmNode, LabCalmRelationship, LabContainment } from './types';

/**
 * Records `childId`'s parent, unless doing so would produce a parent ReactFlow
 * cannot resolve.
 *
 * Lab addition (not in the Hub original): the lab parses the live editor
 * buffer, so a containment relationship can name a container that has not been
 * added to `nodes` yet — ReactFlow throws on a `parentId` with no matching
 * node — or close a loop (A in B, B in A), which the layout walks forever.
 */
function assignParent(parentMap: Map<string, string[]>, childId: string | undefined, containerId: string, knownNodeIds: Set<string>): void {
    if (!childId || childId === containerId || !knownNodeIds.has(containerId)) {
        return;
    }
    // Walk the container's own ancestry: if the child is already above the
    // container, this assignment would close a cycle.
    const seen = new Set<string>();
    const stack = [containerId];
    while (stack.length > 0) {
        const ancestor = stack.pop()!;
        if (ancestor === childId) {
            return;
        }
        if (seen.has(ancestor)) continue;
        seen.add(ancestor);
        stack.push(...(parentMap.get(ancestor) ?? []));
    }
    const parents = parentMap.get(childId) ?? [];
    if (!parents.includes(containerId)) parents.push(containerId);
    parentMap.set(childId, parents);
}

/**
 * Identifies container nodes from deployed-in and composed-of relationships.
 *
 * `nodes` is the document's node list: only containers that are actually
 * present in it can parent a node (see assignParent).
 */
export interface ContainerInfo {
    containerNodeIds: Set<string>;
    /** Every container of each node, in the order first seen. */
    parentMap: Map<string, string[]>;
}

export function identifyContainerNodes(relationships: LabCalmRelationship[], nodes: LabCalmNode[] = []): ContainerInfo {
    const containerNodeIds = new Set<string>();
    const parentMap = new Map<string, string[]>();
    const knownNodeIds = new Set(nodes.map((node) => node?.['unique-id']).filter((id): id is string => Boolean(id)));

    relationships.forEach((rel) => {
        const deployedIn: LabContainment | undefined = rel['relationship-type']?.['deployed-in'];
        if (deployedIn) {
            const containerId = deployedIn.container;
            const childNodeIds = deployedIn.nodes || [];
            if (containerId) {
                containerNodeIds.add(containerId);
                childNodeIds.forEach((childId) => {
                    assignParent(parentMap, childId, containerId, knownNodeIds);
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
                    assignParent(parentMap, childId, containerId, knownNodeIds);
                });
            }
        }
    });

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
}

/** Copies above which a node in several containers is drawn in its first container only. */
const MAX_COPIES = 1000;

export function parseNodes(nodes: LabCalmNode[], containerInfo: ContainerInfo, onShowDetailsCallback?: (node: LabCalmNode) => void): ParsedNodes {
    const regularNodes: Node[] = [];
    const systemNodes: Node[] = [];
    const { containerNodeIds, parentMap } = containerInfo;

    // A node in several containers is drawn once in each, with everything nested in it.
    // The first drawing keeps the CALM id; each other drawing is a copy with its own id.
    type Instance = { id: string; parentId?: string; ancestors: string[] };
    const calmIds = new Set(nodes.map((n) => n['unique-id']).filter((id): id is string => Boolean(id)));
    const takenIds = new Set(calmIds);
    const copyId = (id: string, parentInstanceId: string) => {
        const base = `${id}__in__${parentInstanceId}`;
        let candidate = base;
        for (let i = 2; takenIds.has(candidate); i++) candidate = `${base}_${i}`;
        takenIds.add(candidate);
        return candidate;
    };
    const parentsOf = (id: string, path: Set<string>) =>
        (parentMap.get(id) ?? []).filter((p) => calmIds.has(p) && !path.has(p));

    // Copies multiply with each level of shared containers. Past the limit, draw each node in its first container only.
    const counts = new Map<string, number>();
    const countDrawings = (id: string, path: Set<string>): number => {
        const known = counts.get(id);
        if (known !== undefined) return known;
        const parents = parentsOf(id, path);
        const count = parents.length === 0 ? 1 : parents.reduce((sum, p) => sum + countDrawings(p, new Set(path).add(id)), 0);
        counts.set(id, count);
        return count;
    };
    const capped = [...calmIds].reduce((sum, id) => sum + countDrawings(id, new Set()) - 1, 0) > MAX_COPIES;

    const resolved = new Map<string, Instance[]>();
    const resolveInstances = (id: string, path: Set<string>): Instance[] => {
        const known = resolved.get(id);
        if (known) return known;
        const candidates = parentsOf(id, path);
        const parents = capped ? candidates.slice(0, 1) : candidates;
        const instances: Instance[] = [];
        for (const p of parents) {
            for (const parent of resolveInstances(p, new Set(path).add(id))) {
                const instanceId = instances.length === 0 ? id : copyId(id, parent.id);
                instances.push({ id: instanceId, parentId: parent.id, ancestors: [...parent.ancestors, parent.id] });
            }
        }
        if (instances.length === 0) instances.push({ id, ancestors: [] });
        resolved.set(id, instances);
        return instances;
    };

    const instancesOf = new Map<string, string[]>();
    const ancestorsOf = new Map<string, string[]>();
    nodes.forEach((node) => {
        const id = node['unique-id'];

        if (!id) return;

        const instances = resolveInstances(id, new Set());
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
