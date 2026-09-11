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
function assignParent(parentMap: Map<string, string>, childId: string | undefined, containerId: string, knownNodeIds: Set<string>): void {
    if (!childId || childId === containerId || !knownNodeIds.has(containerId)) {
        return;
    }
    // Walk the container's own ancestry: if the child is already above the
    // container, this assignment would close a cycle.
    const seen = new Set<string>();
    let ancestor: string | undefined = containerId;
    while (ancestor && !seen.has(ancestor)) {
        if (ancestor === childId) {
            return;
        }
        seen.add(ancestor);
        ancestor = parentMap.get(ancestor);
    }
    parentMap.set(childId, containerId);
}

/**
 * Identifies container nodes from deployed-in and composed-of relationships.
 *
 * `nodes` is the document's node list: only containers that are actually
 * present in it can parent a node (see assignParent).
 */
export interface ContainerInfo {
    containerNodeIds: Set<string>;
    parentMap: Map<string, string>;
}

export function identifyContainerNodes(relationships: LabCalmRelationship[], nodes: LabCalmNode[] = []): ContainerInfo {
    const containerNodeIds = new Set<string>();
    const parentMap = new Map<string, string>();
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
function createSystemNode(node: LabCalmNode, parentId: string | undefined): Node {
    const id = node['unique-id']!; // parseNodes only calls this for nodes with an id

    return {
        id,
        type: 'group',
        position: { x: 0, y: 0 },
        style: { zIndex: -1 },
        data: {
            ...node,
            // After the spread: a literal `"label"` in the document must not
            // put a non-string value in front of React.
            label: toDisplayText(node.name || id),
        },
        ...(parentId && { parentId }),
    };
}

/**
 * Creates a regular custom node from a CALM node
 */
function createRegularNode(node: LabCalmNode, parentId: string | undefined, onShowDetailsCallback?: (node: LabCalmNode) => void): Node {
    const id = node['unique-id']!; // parseNodes only calls this for nodes with an id

    return {
        id,
        type: 'custom',
        position: { x: 0, y: 0 },
        data: {
            ...node,
            onShowDetails: onShowDetailsCallback,
            // After the spread: a literal `"label"` in the document must not
            // put a non-string value in front of React.
            label: toDisplayText(node.name || id),
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
}

export function parseNodes(nodes: LabCalmNode[], containerInfo: ContainerInfo, onShowDetailsCallback?: (node: LabCalmNode) => void): ParsedNodes {
    const regularNodes: Node[] = [];
    const systemNodes: Node[] = [];
    const { containerNodeIds, parentMap } = containerInfo;

    nodes.forEach((node) => {
        const id = node['unique-id'];

        if (!id) return;

        const isContainer = containerNodeIds.has(id);
        const parentId = parentMap.get(id);

        if (isContainer) {
            systemNodes.push(createSystemNode(node, parentId));
        } else {
            regularNodes.push(createRegularNode(node, parentId, onShowDetailsCallback));
        }
    });

    return { regularNodes, systemNodes };
}
