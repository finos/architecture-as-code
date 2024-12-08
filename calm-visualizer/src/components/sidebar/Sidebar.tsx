import { IoCloseOutline } from 'react-icons/io5';
import { Edge, Node } from '../cytoscape-renderer/CytoscapeRenderer';

interface SidebarProps {
    selectedData: Node['data'] | Edge['data'];
    closeSidebar: () => void;
}

function isCALMNodeData(data: Node['data'] | Edge['data']): data is Node['data'] {
    return data.id != null && data.type != null;
}

function isCALMEdgeData(data: Node['data'] | Edge['data']): data is Edge['data'] {
    return data.id != null && data.source != null && data.target != null;
}

function Sidebar({ selectedData, closeSidebar }: SidebarProps) {
    // Determine if we have selected a node or edge or something else
    const isCALMNode = isCALMNodeData(selectedData);
    const isCALMEdge = isCALMEdgeData(selectedData);
    console.log('This is the selectedData => ', selectedData);
    return (
        <div className="fixed right-0 h-full w-80 bg-gray-100 shadow-lg">
            <label htmlFor="node-details" className="drawer-overlay" onClick={closeSidebar}></label>
            <div className="menu bg-base-200 text-base-content min-h-full w-80 p-4">
                <div className="flex justify-end">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            closeSidebar();
                        }}
                        className="btn btn-square btn-sm bg-red-500 hover:bg-red-600 text-white"
                    >
                        <IoCloseOutline size={24} />
                    </button>
                </div>
                {isCALMNode && (
                    <div>
                        <div className="text-xl font-bold mb-2">Node Details</div>
                        <div className="space-y-2">
                            <p>
                                <span className="font-semibold">unique-id: {selectedData.id}</span>
                            </p>

                            <p>
                                <span className="font-semibold">name: {selectedData.label}</span>
                            </p>

                            <p>
                                <span className="font-semibold">
                                    node-type: {selectedData.type}
                                </span>
                            </p>

                            <p>
                                <span className="font-semibold">
                                    description: {selectedData.description}
                                </span>
                            </p>
                        </div>
                    </div>
                )}

                {isCALMEdge && (
                    <div>
                        <div className="text-xl font-bold mb-2">Edge Details</div>
                        <div className="space-y-2">
                            <p>
                                <span className="font-semibold">unique-id: {selectedData.id}</span>
                            </p>

                            <p>
                                <span className="font-semibold">
                                    description: {selectedData.label}
                                </span>
                            </p>

                            <p>
                                <span className="font-semibold">source: {selectedData.source}</span>
                            </p>

                            <p>
                                <span className="font-semibold">target: {selectedData.target}</span>
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

export default Sidebar;
