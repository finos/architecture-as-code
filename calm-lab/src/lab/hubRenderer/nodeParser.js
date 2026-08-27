// Ported from calm-hub-ui/src/visualizer/components/reactflow/utils/nodeParser.ts (commit c4f983cc).
// Keep logic in sync until the shared renderer package extraction.

import { toDisplayText } from './calmHelpers';

/**
 * Records `childId`'s parent, unless doing so would produce a parent ReactFlow
 * cannot resolve.
 *
 * Lab addition (not in the Hub original): the lab parses the live editor
 * buffer, so a containment relationship can name a container that has not been
 * added to `nodes` yet — ReactFlow throws on a `parentId` with no matching
 * node — or close a loop (A in B, B in A), which the layout walks forever.
 */
function assignParent(parentMap, childId, containerId, knownNodeIds) {
    if (!childId || childId === containerId || !knownNodeIds.has(containerId)) {
        return;
    }
    // Walk the container's own ancestry: if the child is already above the
    // container, this assignment would close a cycle.
    const seen = new Set();
    let ancestor = containerId;
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
export function identifyContainerNodes(relationships, nodes = []) {
    const containerNodeIds = new Set();
    const parentMap = new Map();
    const knownNodeIds = new Set(nodes.map((node) => node?.['unique-id']).filter(Boolean));

    relationships.forEach((rel) => {
        const deployedIn = rel['relationship-type']?.['deployed-in'];
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

        const composedOf = rel['relationship-type']?.['composed-of'];
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
function createSystemNode(node, parentId) {
    const id = node['unique-id'];

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
function createRegularNode(node, parentId, onShowDetailsCallback) {
    const id = node['unique-id'];

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
export function parseNodes(nodes, containerInfo, onShowDetailsCallback) {
    const regularNodes = [];
    const systemNodes = [];
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
