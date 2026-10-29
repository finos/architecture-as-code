import { Node } from 'reactflow';
import { CalmNodeSchema, CalmRelationshipSchema } from '@finos/calm-models/types';

/**
 * Container information extracted from relationships
 */
export interface ContainerInfo {
    containerNodeIds: Set<string>;
    /** Every container of each node, in the order first seen. */
    parentMap: Map<string, string[]>;
}

/**
 * Identifies container nodes from deployed-in and composed-of relationships
 */
export function identifyContainerNodes(relationships: CalmRelationshipSchema[]): ContainerInfo {
    const containerNodeIds = new Set<string>();
    const parentMap = new Map<string, string[]>();
    const addParent = (childId: string, containerId: string) => {
        const parents = parentMap.get(childId) ?? [];
        if (!parents.includes(containerId)) parents.push(containerId);
        parentMap.set(childId, parents);
    };

    relationships.forEach((rel) => {
        const deployedIn = rel['relationship-type']?.['deployed-in'];
        if (deployedIn) {
            const containerId = deployedIn.container;
            const childNodeIds = deployedIn.nodes || [];
            if (containerId) {
                containerNodeIds.add(containerId);
                childNodeIds.forEach((childId: string) => {
                    addParent(childId, containerId);
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
                    addParent(childId, containerId);
                });
            }
        }
    });

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

/**
 * Parses CALM nodes into ReactFlow nodes
 */
/** Drawings above which a node in several containers is drawn in its first container only. */
const MAX_DRAWINGS = 1000;

export function parseNodes(
    nodes: CalmNodeSchema[],
    containerInfo: ContainerInfo,
    onShowDetailsCallback?: (nodeData: CalmNodeSchema) => void
): ParsedNodes {
    const regularNodes: Node[] = [];
    const systemNodes: Node[] = [];
    const { containerNodeIds, parentMap } = containerInfo;

    // A node in several containers is drawn once in each, with everything nested in it.
    // The first drawing keeps the CALM id; each other drawing is a copy with its own id.
    type Instance = { id: string; parentId?: string; ancestors: string[] };
    const calmIds = new Set(nodes.map((n) => n['unique-id']).filter(Boolean));
    const takenIds = new Set(calmIds);
    const copyId = (id: string, parentInstanceId: string) => {
        const base = `${id}__in__${parentInstanceId}`;
        let candidate = base;
        for (let i = 2; takenIds.has(candidate); i++) candidate = `${base}_${i}`;
        takenIds.add(candidate);
        return candidate;
    };
    const parentsOf = (id: string, path: Set<string>) =>
        (parentMap.get(id) ?? []).filter((p) => p !== id && calmIds.has(p) && !path.has(p));

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
    const capped = [...calmIds].reduce((sum, id) => sum + countDrawings(id, new Set()), 0) > MAX_DRAWINGS;

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
