import { Sidebar } from '../sidebar/Sidebar.js';
import { useCallback, useEffect, useState } from 'react';
import {
    CalmArchitectureSchema,
    CalmNodeSchema,
} from '../../../../../shared/src/types/core-types.js';
import { CytoscapeNode, Edge } from '../../contracts/contracts.js';
import { VisualizerContainer } from '../visualizer-container/VisualizerContainer.js';
import { Data } from '../../../model/calm.js';
import { useDropzone } from 'react-dropzone';

interface DrawerProps {
    data?: Data; // Optional data prop passed in from CALM Hub if user navigates from there
}

function getComposedOfRelationships(calmInstance: CalmArchitectureSchema) {
    const composedOfRelationships: {
        [idx: string]: {
            type: 'parent' | 'child';
            parent?: string;
        };
    } = {};

    calmInstance.relationships?.forEach((relationship) => {
        const rel = relationship['relationship-type']['composed-of'];
        if (rel) {
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
        const rel = relationship['relationship-type']['deployed-in'];
        if (rel) {
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

export function Drawer({ data }: DrawerProps) {
    const [title, setTitle] = useState<string>('');
    const [calmInstance, setCALMInstance] = useState<CalmArchitectureSchema | undefined>(undefined);
    const [fileInstance, setFileInstance] = useState<string | undefined>(undefined);
    const [selectedNode, setSelectedNode] = useState<CytoscapeNode | null>(null);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (acceptedFiles[0]) {
            setTitle(acceptedFiles[0].name);
            const fileText = await acceptedFiles[0].text();
            setFileInstance(JSON.parse(fileText));
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

    useEffect(() => {
        setTitle(title ?? data?.name);
        setCALMInstance((fileInstance as CalmArchitectureSchema) ?? data?.data);
    }, [fileInstance, title, data]);

    function closeSidebar() {
        setSelectedNode(null);
    }

    function generateDisplayPlaceHolderWithoutDesc(node: CalmNodeSchema): string {
        return `${node.name}\n[${node['node-type']}]`;
    }

    function getNodes(): CytoscapeNode[] {
        if (!calmInstance || !calmInstance.relationships) return [];

        const composedOfRelationships = getComposedOfRelationships(calmInstance);
        const deployedInRelationships = getDeployedInRelationships(calmInstance);

        return (calmInstance.nodes ?? []).map((node) => {
            const newData: CytoscapeNode = {
                classes: 'node',
                data: {
                    id: node['unique-id'],
                    name: node.name,
                    description: node.description,
                    type: node['node-type'],
                    cytoscapeProps: {
                        labelWithDescription: `${generateDisplayPlaceHolderWithoutDesc(node)}\n\n${node.description}\n`,
                        labelWithoutDescription: `${generateDisplayPlaceHolderWithoutDesc(node)}`,
                    },
                },
            };

            if (node.interfaces) {
                newData.data.interfaces = node.interfaces;
            }

            if (node.controls) {
                newData.data.controls = node.controls;
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
            .filter(
                (relationship) =>
                    !relationship['relationship-type']['composed-of'] &&
                    !relationship['relationship-type']['deployed-in']
            )
            .map((relationship) => {
                if (relationship['relationship-type'].interacts) {
                    return {
                        data: {
                            id: relationship['unique-id'],
                            label: relationship.description || '',
                            source: relationship['relationship-type'].interacts.actor,
                            target: relationship['relationship-type'].interacts.nodes[0],
                        },
                    };
                }
                if (relationship['relationship-type'].connects) {
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

    function createStorageKey(title: string, data?: Data): string {
        if (!data || !data.name || !data.calmType || !data.id || !data.version) {
            return title;
        }
        return `${data.name}/${data.calmType}/${data.id}/${data.version}`;
    }

    const edges = getEdges();
    const nodes = getNodes();

    return (
        <div {...getRootProps()} className="flex-1 flex overflow-hidden h-screen">
            {!calmInstance && <input {...getInputProps()} />}
            <div className={`drawer drawer-end ${selectedNode ? 'drawer-open' : ''} w-full`}>
                <input
                    type="checkbox"
                    aria-label="drawer-toggle"
                    className="drawer-toggle"
                    checked={!!selectedNode}
                    onChange={closeSidebar}
                />
                <div className="drawer-content">
                    {calmInstance ? (
                        <VisualizerContainer
                            title={title}
                            nodes={nodes}
                            edges={edges}
                            calmKey={createStorageKey(title, data)}
                        />
                    ) : (
                        <div className="flex justify-center items-center h-full w-full">
                            {isDragActive ? (
                                <p>Drop your file here ...</p>
                            ) : (
                                <p>
                                    {'Drag and drop your file here or '}
                                    <span className="border-b border-dotted border-black pb-1">
                                        Browse
                                    </span>
                                </p>
                            )}
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
