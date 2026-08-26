// Ported from calm-hub-ui/src/visualizer/components/reactflow/utils/nodeParser.ts (commit c4f983cc).
// Keep logic in sync until the shared renderer package extraction.

/**
 * Identifies container nodes from deployed-in and composed-of relationships
 */
export function identifyContainerNodes(relationships) {
    const containerNodeIds = new Set();
    const parentMap = new Map();

    relationships.forEach((rel) => {
        const deployedIn = rel['relationship-type']?.['deployed-in'];
        if (deployedIn) {
            const containerId = deployedIn.container;
            const childNodeIds = deployedIn.nodes || [];
            if (containerId) {
                containerNodeIds.add(containerId);
                childNodeIds.forEach((childId) => {
                    parentMap.set(childId, containerId);
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
                    parentMap.set(childId, containerId);
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
            label: node.name || id,
            ...node,
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
            label: node.name || id,
            ...node,
            onShowDetails: onShowDetailsCallback,
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
