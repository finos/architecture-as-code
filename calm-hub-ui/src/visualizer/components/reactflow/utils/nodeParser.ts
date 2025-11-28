import { Node } from 'reactflow';
import { CalmNodeSchema, CalmRelationshipSchema } from '../../../../../../calm-models/src/types/core-types.js';

/**
 * Container information extracted from relationships
 */
export interface ContainerInfo {
    containerNodeIds: Set<string>;
    parentMap: Map<string, string>;
}

/**
 * Identifies container nodes from deployed-in and composed-of relationships
 */
export function identifyContainerNodes(relationships: CalmRelationshipSchema[]): ContainerInfo {
    const containerNodeIds = new Set<string>();
    const parentMap = new Map<string, string>();

    relationships.forEach((rel) => {
        const deployedIn = rel['relationship-type']?.['deployed-in'];
        if (deployedIn) {
            const containerId = deployedIn.container;
            const childNodeIds = deployedIn.nodes || [];
            if (containerId) {
                containerNodeIds.add(containerId);
                childNodeIds.forEach((childId: string) => {
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
                childNodeIds.forEach((childId: string) => {
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
function createSystemNode(
    node: CalmNodeSchema,
    parentId: string | undefined
): Node {
    const id = node['unique-id'];
    const nodeType = node['node-type'];

    return {
        id,
        type: 'group',
        position: { x: 0, y: 0 },
        style: { zIndex: -1 },
        data: {
            id,
            type: nodeType || 'system',
            label: node.name || id,
            nodeType: nodeType || 'system',
            ...node,
        },
        ...(parentId && { parentId, expandParent: true }),
    };
}

/**
 * Creates a regular custom node from a CALM node
 */
function createRegularNode(
    node: CalmNodeSchema,
    parentId: string | undefined,
    onShowDetailsCallback?: (nodeData: CalmNodeSchema) => void
): Node {
    const id = node['unique-id'];
    const nodeType = node['node-type'];

    return {
        id,
        type: 'custom',
        position: { x: 0, y: 0 },
        data: {
            id,
            type: nodeType,
            label: node.name || id,
            ...node,
            onShowDetails: onShowDetailsCallback,
        },
        ...(parentId && { parentId, expandParent: true }),
    };
}

/**
 * Result of parsing nodes
 */
export interface ParsedNodes {
    regularNodes: Node[];
    systemNodes: Node[];
}

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

    nodes.forEach((node) => {
        const id = node['unique-id'];
        const nodeType = node['node-type'];

        if (!id) return;

        const isContainer = containerNodeIds.has(id);
        const isSystemNode = nodeType === 'system' || isContainer;
        const parentId = parentMap.get(id);

        if (isSystemNode) {
            systemNodes.push(createSystemNode(node, parentId));
        } else {
            regularNodes.push(createRegularNode(node, parentId, onShowDetailsCallback));
        }
    });

    return { regularNodes, systemNodes };
}
