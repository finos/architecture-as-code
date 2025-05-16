import { Sidebar } from '../sidebar/Sidebar.js';
import { useState } from 'react';
import { CytoscapeRenderer, CalmNode, Edge } from '../cytoscape-renderer/CytoscapeRenderer.js';
import {
    CalmArchitectureSchema,
    CalmRelationshipSchema,
} from '../../../../../shared/src/types/core-types.js';
import {
    CALMDeployedInRelationship,
    CALMComposedOfRelationship,
    CALMConnectsRelationship,
    CALMInteractsRelationship,
} from '../../../../../shared/src/types.js';

interface DrawerProps {
    calmInstance?: CalmArchitectureSchema;
    title?: string;
    isNodeDescActive: boolean;
    isConDescActive: boolean;
}

function isComposedOf(
    relationship: CalmRelationshipSchema
): relationship is CALMComposedOfRelationship {
    return 'composed-of' in relationship['relationship-type'];
}

function isDeployedIn(
    relationship: CalmRelationshipSchema
): relationship is CALMDeployedInRelationship {
    return 'deployed-in' in relationship['relationship-type'];
}

function isInteracts(
    relationship: CalmRelationshipSchema
): relationship is CALMInteractsRelationship {
    return 'interacts' in relationship['relationship-type'];
}

function isConnects(
    relationship: CalmRelationshipSchema
): relationship is CALMConnectsRelationship {
    return 'connects' in relationship['relationship-type'];
}

function getComposedOfRelationships(calmInstance: CalmArchitectureSchema) {
    const composedOfRelationships: {
        [idx: string]: {
            type: 'parent' | 'child';
            parent?: string;
        };
    } = {};

    calmInstance.relationships?.forEach((relationship) => {
        if (isComposedOf(relationship)) {
            const rel = relationship['relationship-type']['composed-of'];
            composedOfRelationships[rel!['container']] = { type: 'parent' };
            rel!['nodes'].forEach((node) => {
                composedOfRelationships[node] = {
                    type: 'child',
                    parent: rel!['container'],
                };
            });
        }
    });

    return composedOfRelationships;
}

function getDeployedInRelationships(calmInstance: CalmArchitectureSchema) {
    const deployedInRelationships: {
        [idx: string]: {
            type: 'parent' | 'child';
            parent?: string;
        };
    } = {};
    calmInstance.relationships?.forEach((relationship) => {
        if (isDeployedIn(relationship)) {
            const rel = relationship['relationship-type']['deployed-in'];
            deployedInRelationships[rel['container']] = { type: 'parent' };
            rel['nodes'].forEach((node) => {
                deployedInRelationships[node] = {
                    type: 'child',
                    parent: rel['container'],
                };
            });
        }
    });

    return deployedInRelationships;
}

export function Drawer({ calmInstance, title, isConDescActive, isNodeDescActive }: DrawerProps) {
    const [selectedNode, setSelectedNode] = useState<CalmNode | null>(null);

    function closeSidebar() {
        setSelectedNode(null);
    }

    function getNodes(): CalmNode[] {
        if (!calmInstance || !calmInstance.relationships) return [];

        const composedOfRelationships = getComposedOfRelationships(calmInstance);
        const deployedInRelationships = getDeployedInRelationships(calmInstance);

        return (calmInstance.nodes ?? []).map((node) => {
            const newData: CalmNode = {
                classes: 'node',
                data: {
                    label: node.name,
                    description: node.description,
                    type: node['node-type'],
                    id: node['unique-id'],
                    _displayPlaceholderWithDesc: `${node.name}\n\n\n${node['node-type']}\n\n\n${node.description}\n`,
                    _displayPlaceholderWithoutDesc: `${node.name}\n\n\n${node['node-type']}`,
                },
            };

            if (node.interfaces) {
                newData.data.interfaces = node.interfaces;
            }

            const composedOfRel = composedOfRelationships[node['unique-id']];
            const deployedInRel = deployedInRelationships[node['unique-id']];

            if (composedOfRel?.type === 'parent' || deployedInRel?.type === 'parent') {
                newData.classes = 'group';
            }

            const parentId =
                composedOfRel?.type === 'child' && composedOfRel.parent
                    ? composedOfRel.parent
                    : deployedInRel?.type === 'child' && deployedInRel.parent
                    ? deployedInRel.parent
                    : undefined;

            if (parentId) {
                newData.data.parent = parentId;
            }
            return newData;
        });
    }

    function getEdges(): Edge[] {
        if (!calmInstance || !calmInstance.relationships) return [];

        return calmInstance.relationships
            .filter((relationship) => !isComposedOf(relationship) && !isDeployedIn(relationship))
            .map((relationship) => {
                if (isInteracts(relationship)) {
                    return {
                        data: {
                            id: relationship['unique-id'],
                            label: relationship.description || '',
                            source: relationship['relationship-type'].interacts.actor,
                            target: relationship['relationship-type'].interacts.nodes[0],
                        },
                    };
                }
                if (isConnects(relationship)) {
                    const source = relationship['relationship-type'].connects.source.node;
                    const target = relationship['relationship-type'].connects.destination.node;
                    return {
                        data: {
                            id: relationship['unique-id'],
                            label: relationship.description || '',
                            source,
                            target,
                        },
                    };
                }
            })
            .filter((edge): edge is Edge => edge !== undefined);
    }

    const edges = getEdges();
    const nodes = getNodes();

    return (
        <div className="flex-1 flex overflow-hidden">
            <div className={`drawer drawer-end ${selectedNode ? 'drawer-open' : ''}`}>
                <input
                    type="checkbox"
                    aria-label="drawer-toggle"
                    className="drawer-toggle"
                    checked={!!selectedNode}
                    onChange={closeSidebar}
                />
                <div className="drawer-content">
                    {calmInstance ? (
                        <CytoscapeRenderer
                            isConDescActive={isConDescActive}
                            isNodeDescActive={isNodeDescActive}
                            title={title}
                            nodes={nodes}
                            edges={edges}
                        />
                    ) : (
                        <div className="flex justify-center items-center h-full">
                            No file selected
                        </div>
                    )}
                </div>
                {selectedNode && (
                    <Sidebar selectedData={selectedNode['data']} closeSidebar={closeSidebar} />
                )}
            </div>
        </div>
    );
}
