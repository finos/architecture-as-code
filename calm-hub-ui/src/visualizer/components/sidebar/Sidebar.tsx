import { IoAddOutline, IoCloseOutline, IoRemoveOutline } from 'react-icons/io5';
import { Edge, CalmNode } from '../cytoscape-renderer/CytoscapeRenderer.js';
import { Key, useState } from 'react';

interface SidebarProps {
    selectedData: CalmNode['data'] | Edge['data'];
    closeSidebar: () => void;
}

function isCALMNodeData(data: CalmNode['data'] | Edge['data']): data is CalmNode['data'] {
    return data.id != null && data.type != null;
}

function isCALMEdgeData(data: CalmNode['data'] | Edge['data']): data is Edge['data'] {
    return (
        'source' in data &&
        'target' in data &&
        data.id != null &&
        data.source != null &&
        data.target != null
    );
}

export function Sidebar({ selectedData, closeSidebar }: SidebarProps) {
    const [isInterfacesVisible, setIsInterfacesVisible] = useState(true);

    const toggleInterfacesVisibility = () => {
        setIsInterfacesVisible((prev) => !prev);
    };

    // Determine if we have selected a node or edge or something else
    const isCALMNode = isCALMNodeData(selectedData);
    const isCALMEdge = isCALMEdgeData(selectedData);

    return (
        <div className="fixed right-0 h-full w-80 bg-base-300 shadow-lg">
            <label htmlFor="node-details" className="drawer-overlay" onClick={closeSidebar}></label>
            <div className="menu bg-base-300 text-base-content min-h-full w-80 p-4">
                <div className="flex justify-end">
                    <button
                        aria-label="close-sidebar"
                        onClick={(e) => {
                            e.stopPropagation();
                            closeSidebar();
                        }}
                        className="btn btn-square btn-xs bg-red-500 hover:bg-red-600 text-white"
                    >
                        <IoCloseOutline size={24} />
                    </button>
                </div>
                {isCALMNode && (
                    <div>
                        <div className="text-xl font-bold mb-2">Node Details</div>
                        <div className="space-y-2">
                            <p>
                                <span className="font-light">unique-id: </span>
                                <span className="font-semibold">{selectedData.id}</span>
                            </p>
                            <p>
                                <span className="font-light">name: </span>
                                <span className="font-semibold">{selectedData.label}</span>
                            </p>
                            <p>
                                <span className="font-light">node-type: </span>
                                <span className="font-semibold">{selectedData.type}</span>
                            </p>
                            <p>
                                <span className="font-light">description: </span>
                                <span className="font-semibold">{selectedData.description}</span>
                            </p>

                            <p>
                                <div className="flex items-center justify-between">
                                    <span className="font-light">interfaces: </span>
                                    <button
                                        aria-label="toggle-interfaces"
                                        onClick={toggleInterfacesVisibility}
                                        className="ml-auto btn btn-xs btn-outline"
                                    >
                                        {isInterfacesVisible ? (
                                            <IoRemoveOutline size={16} />
                                        ) : (
                                            <IoAddOutline size={16} />
                                        )}
                                    </button>
                                </div>{' '}
                            </p>
                            <div className="space-y-4">
                                {selectedData.interfaces?.map((interfaceItem: any, index: Key) => (
                                    <div key={index} className="ml-4 border-b border-gray-300 pb-4">
                                        <div className="space-y-1">
                                            {Object.entries(interfaceItem).map(([key, value]) => (
                                                <div key={key} className="flex cursor-default">
                                                    <span className="font-light">
                                                        {key}:{''}
                                                    </span>
                                                    <span className="font-semibold">
                                                        {String(value)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {isCALMEdge && (
                    <div>
                        <div className="text-xl font-bold mb-2">Edge Details</div>
                        <div className="space-y-2">
                            <p>
                                <span className="font-light">unique-id: </span>
                                <span className="font-semibold">{selectedData.id}</span>
                            </p>

                            <p>
                                <span className="font-light">description: </span>
                                <span className="font-semibold">{selectedData.label}</span>
                            </p>

                            <p>
                                <span className="font-light">source: </span>
                                <span className="font-semibold">{selectedData.source}</span>
                            </p>

                            <p>
                                <span className="font-light">target: </span>
                                <span className="font-semibold">{selectedData.target}</span>
                            </p>
                        </div>
                    </div>
                )}

                {!isCALMEdge && !isCALMNode && (
                    <div className="text-xl font-bold mb-2">Unknown Selected Entity</div>
                )}
            </div>
        </div>
    );
}
