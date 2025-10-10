import { CalmArchitectureSchema, CalmNodeSchema, CalmRelationshipSchema } from '../../../../calm-models/src/types/core-types.js';
import { CytoscapeNode, CytoscapeEdge } from '../contracts/contracts.js';

type RelationshipMapping = {
    [nodeId: string]: {
        isParent?: boolean;
        isChild?: boolean;
        parent?: string;
    };
};

// Relationship Extraction

function extractHierarchicalRelationships(
    calmInstance: CalmArchitectureSchema,
    relationshipKey: 'composed-of' | 'deployed-in'
): RelationshipMapping {
    const relationships: RelationshipMapping = {};

    if (!calmInstance.relationships) {
        return relationships;
    }

    for (const relationship of calmInstance.relationships) {
        const rel = relationship['relationship-type'][relationshipKey];

        if (rel) {
            // Mark container as parent
            if (!relationships[rel.container]) {
                relationships[rel.container] = {};
            }
            relationships[rel.container].isParent = true;

            // Mark contained nodes as children
            for (const nodeId of rel.nodes) {
                if (!relationships[nodeId]) {
                    relationships[nodeId] = {};
                }
                relationships[nodeId].isChild = true;
                relationships[nodeId].parent = rel.container;
            }
        }
    }

    return relationships;
}

// Node Conversion

function generateNodeLabel(node: CalmNodeSchema, includeDescription: boolean): string {
    const baseLabel = `${node.name}\n[${node['node-type']}]`;

    if (includeDescription && node.description) {
        return `${baseLabel}\n\n${node.description}\n`;
    }

    return baseLabel;
}

function isGroupNode(
    nodeId: string,
    composedOfRel: RelationshipMapping,
    deployedInRel: RelationshipMapping
): boolean {
    return (
        composedOfRel[nodeId]?.isParent === true ||
        deployedInRel[nodeId]?.isParent === true
    );
}

function getParentNodeId(
    nodeId: string,
    composedOfRel: RelationshipMapping,
    deployedInRel: RelationshipMapping
): string | undefined {
    const composedOfChild = composedOfRel[nodeId];
    if (composedOfChild?.isChild && composedOfChild.parent) {
        return composedOfChild.parent;
    }

    const deployedInChild = deployedInRel[nodeId];
    if (deployedInChild?.isChild && deployedInChild.parent) {
        return deployedInChild.parent;
    }

    return undefined;
}

function convertCalmNodeToCytoscapeNode(
    node: CalmNodeSchema,
    composedOfRel: RelationshipMapping,
    deployedInRel: RelationshipMapping
): CytoscapeNode {
    const nodeId = node['unique-id'];

    const cytoscapeNode: CytoscapeNode = {
        classes: 'node',
        data: {
            id: nodeId,
            name: node.name,
            description: node.description,
            type: node['node-type'],
            cytoscapeProps: {
                labelWithDescription: generateNodeLabel(node, true),
                labelWithoutDescription: generateNodeLabel(node, false),
            },
        },
    };

    if (node.interfaces) {
        cytoscapeNode.data.interfaces = node.interfaces;
    }

    if (node.controls) {
        cytoscapeNode.data.controls = node.controls;
    }

    if (isGroupNode(nodeId, composedOfRel, deployedInRel)) {
        cytoscapeNode.classes = 'group';
    }

    const parentId = getParentNodeId(nodeId, composedOfRel, deployedInRel);
    if (parentId) {
        cytoscapeNode.data.parent = parentId;
    }

    return cytoscapeNode;
}

export function convertCalmNodesToCytoscapeNodes(
    calmInstance: CalmArchitectureSchema
): CytoscapeNode[] {
    if (!calmInstance?.relationships || !calmInstance.nodes) {
        return [];
    }

    const composedOfRel = extractHierarchicalRelationships(calmInstance, 'composed-of');
    const deployedInRel = extractHierarchicalRelationships(calmInstance, 'deployed-in');

    return calmInstance.nodes.map((node) =>
        convertCalmNodeToCytoscapeNode(node, composedOfRel, deployedInRel)
    );
}


// Edge Conversion

function isHierarchicalRelationship(relationship: CalmRelationshipSchema): boolean {
    return (
        relationship['relationship-type']['composed-of'] !== undefined ||
        relationship['relationship-type']['deployed-in'] !== undefined
    );
}

function convertInteractsRelationship(relationship: CalmRelationshipSchema): CytoscapeEdge | undefined {
    const interacts = relationship['relationship-type'].interacts;

    if (!interacts?.nodes?.[0]) {
        return undefined;
    }

    return {
        data: {
            id: relationship['unique-id'],
            label: relationship.description || '',
            source: interacts.actor,
            target: interacts.nodes[0],
        },
    };
}

function convertConnectsRelationship(relationship: CalmRelationshipSchema): CytoscapeEdge | undefined {
    const connects = relationship['relationship-type'].connects;

    if (!connects?.source?.node || !connects?.destination?.node) {
        return undefined;
    }

    return {
        data: {
            id: relationship['unique-id'],
            label: relationship.description || '',
            source: connects.source.node,
            target: connects.destination.node,
        },
    };
}

function convertCalmRelationshipToEdge(relationship: CalmRelationshipSchema): CytoscapeEdge | undefined {
    const relType = relationship['relationship-type'];

    if (relType.interacts) {
        return convertInteractsRelationship(relationship);
    }

    if (relType.connects) {
        return convertConnectsRelationship(relationship);
    }

    return undefined;
}

export function convertCalmRelationshipsToEdges(
    calmInstance: CalmArchitectureSchema
): CytoscapeEdge[] {
    if (!calmInstance?.relationships) {
        return [];
    }

    return calmInstance.relationships
        .filter((relationship) => !isHierarchicalRelationship(relationship))
        .map((relationship) => convertCalmRelationshipToEdge(relationship))
        .filter((edge): edge is CytoscapeEdge => edge !== undefined);
}

export function convertCalmToCytoscape(calmInstance: CalmArchitectureSchema | undefined): {
    nodes: CytoscapeNode[];
    edges: CytoscapeEdge[];
} {
    if (!calmInstance) {
        return { nodes: [], edges: [] };
    }

    return {
        nodes: convertCalmNodesToCytoscapeNodes(calmInstance),
        edges: convertCalmRelationshipsToEdges(calmInstance),
    };
}
