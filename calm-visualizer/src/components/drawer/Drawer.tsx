import Sidebar from '../sidebar/Sidebar';
import { useState } from 'react';
import CytoscapeRenderer, { Node, Edge } from '../cytoscape-renderer/CytoscapeRenderer.tsx';
import {
    CALMArchitecture,
    CALMComposedOfRelationship,
    CALMConnectsRelationship,
    CALMDeployedInRelationship,
    CALMInteractsRelationship,
    CALMRelationship,
} from '../../../../shared/src';

interface DrawerProps {
    calmInstance?: CALMArchitecture;
    title?: string;
    isNodeDescActive: boolean;
    isConDescActive: boolean;
}

function isComposedOf(relationship: CALMRelationship): relationship is CALMComposedOfRelationship {
    return 'composed-of' in relationship['relationship-type'];
}

function isDeployedIn(relationship: CALMRelationship): relationship is CALMDeployedInRelationship {
    return 'deployed-in' in relationship['relationship-type'];
}

function isInteracts(relationship: CALMRelationship): relationship is CALMInteractsRelationship {
    return 'interacts' in relationship['relationship-type'];
}

function isConnects(relationship: CALMRelationship): relationship is CALMConnectsRelationship {
    return 'connects' in relationship['relationship-type'];
}

const getComposedOfRelationships = (calmInstance: CALMInstantiation) => {
    const composedOfRelationships: {
        [idx: string]: {
            type: 'parent' | 'child';
            parent?: string;
        };
    } = {};

    calmInstance.relationships.forEach((relationship) => {
        if (isComposedOf(relationship)) {
            const rel = relationship['relationship-type']['composed-of'];
            composedOfRelationships[rel['container']] = { type: 'parent' };
            rel['nodes'].forEach((node) => {
                composedOfRelationships[node] = {
                    type: 'child',
                    parent: rel['container'],
                };
            });
        }
    });

    return composedOfRelationships;
};
const getDeployedInRelationships = (calmInstance: CALMInstantiation) => {
    const deployedInRelationships: {
        [idx: string]: {
            type: 'parent' | 'child';
            parent?: string;
        };
    } = {};
    calmInstance.relationships.forEach((relationship) => {
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
};

function Drawer({ calmInstance, title, isConDescActive, isNodeDescActive }: DrawerProps) {
    const [selectedNode, setSelectedNode] = useState(null);

    function closeSidebar() {
        setSelectedNode(null);
    }

    function getNodes(): Node[] {
        if (!calmInstance || !calmInstance.relationships) return [];

        const composedOfRelationships = getComposedOfRelationships(calmInstance);
        const deployedInRelationships = getDeployedInRelationships(calmInstance);
        const nodes = calmInstance.nodes.map((node) => {
            const newData: Node = {
                classes: 'node',
                data: {
                    label: node.name,
                    description: node.description,
                    type: node['node-type'],
                    id: node['unique-id'],
                },
            };

            if (composedOfRelationships[node['unique-id']]?.type === 'parent') {
                newData.classes = 'group';
            }

            if (
                composedOfRelationships[node['unique-id']]?.type === 'child' &&
                composedOfRelationships[node['unique-id']]['parent']
            ) {
                newData.data.parent = composedOfRelationships[node['unique-id']].parent!;
            }

            if (deployedInRelationships[node['unique-id']]?.type === 'parent') {
                newData.classes = 'group';
            }

            if (
                deployedInRelationships[node['unique-id']]?.type === 'child' &&
                deployedInRelationships[node['unique-id']]['parent'] &&
                !newData.data.parent
            ) {
                newData.data.parent = deployedInRelationships[node['unique-id']].parent!;
            }
            return newData;
        });

        return nodes;
    }

    function getEdges(): Edge[] {
        if (!calmInstance || !calmInstance.relationships) return [];

        const edges = calmInstance.relationships
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
            .filter((edge) => edge !== undefined);
        return edges;
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
                    <Sidebar selectedData={selectedNode} closeSidebar={closeSidebar} />
                )}
            </div>
        </div>
    );
}

export default Drawer;
