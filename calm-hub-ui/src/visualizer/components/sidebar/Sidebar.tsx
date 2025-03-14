import { IoCloseOutline, IoPencil, IoSave, IoSaveOutline } from 'react-icons/io5';
import { Edge, Node } from '../cytoscape-renderer/CytoscapeRenderer.js';
import { useEffect, useState } from 'react';

interface SidebarProps {
    selectedData: Node['data'] | Edge['data'];
    closeSidebar: () => void;
    updateElement: (updatedData: Node['data'] | Edge['data']) => void;
}

function isCALMNodeData(data: Node['data'] | Edge['data']): data is Node['data'] {
    return data.id != null && data.type != null;
}

function isCALMEdgeData(data: Node['data'] | Edge['data']): data is Edge['data'] {
    return data.id != null && data.source != null && data.target != null;
}

function Sidebar({ selectedData, closeSidebar, updateElement }: SidebarProps) {
    // Determine if we have selected a node or edge or something else
    const isCALMNode = isCALMNodeData(selectedData);
    const isCALMEdge = isCALMEdgeData(selectedData);

    const isShell = selectedData.isShell === true;

    const [isEditMode, setIsEditMode] = useState(isShell);
    const [editedData, setEditedData] = useState<Node['data'] | Edge['data']>({ ...selectedData });

    // Reset the edited data when the selected data changes
    useEffect(() => {
        setEditedData({ ...selectedData });
        setIsEditMode(selectedData.isShell === true);
    }, [selectedData]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setEditedData((prev) => ({ ...prev, [name]: value }));
    };

    const saveChanges = () => {
        const updatedData = { ...editedData };
        if (updatedData.isShell) {
            updatedData.isShell = false;
        }
        updateElement(updatedData);
        setIsEditMode(false);
    };

    const canEditID = isCALMNode && selectedData.isShell === true;
    return (
        <div className="fixed right-0 h-full w-80 bg-base-300 shadow-lg z-10">
            <label htmlFor="node-details" className="drawer-overlay" onClick={closeSidebar}></label>
            <div className="menu bg-base-300 text-base-content min-h-full w-80 p-4">
                <div className="flex justify-between items-center mb-4">
                    <div className="text-xl font-bold">
                        {isShell ? (
                            <span className="text-blue-500">
                                {isCALMNode ? 'New Node' : 'New Connection'}
                            </span>
                        ) : (
                            <span>
                                {isCALMNode
                                    ? 'Node Details'
                                    : isCALMEdge
                                      ? 'Edge Details'
                                      : 'Unknown Entity'}
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {!isEditMode && (
                            <button
                                onClick={() => setIsEditMode(true)}
                                className="btn btn-square btn-sm bg-blue-500 hover:bg-blue-600 text-white"
                                aria-label="Edit details"
                            >
                                <IoPencil size={20} />
                            </button>
                        )}

                        <button
                        aria-label="close-sidebar"
                            onClick={(e) => {
                                e.stopPropagation();
                                closeSidebar();
                            }}
                            className="btn btn-square btn-sm bg-red-500 hover:bg-red-600 text-white"
                        >
                            <IoCloseOutline size={24} />
                        </button>
                    </div>
                </div>

                {isEditMode ? (
                    <div className="space-y-4">
                        {isCALMNode && (
                            <>
                                <div>
                                    <label className="block text-sm font-light">
                                        Unique ID {canEditID ? '(editable)' : '(read-only)'}
                                    </label>
                                    <input
                                        id="unique-id"
                                        type="text"
                                        name="id"
                                        value={editedData.id}
                                        onChange={handleInputChange}
                                        readOnly={!canEditID}
                                        className="input input-bordered w-full mt-1"
                                        placeholder="Enter unique ID"
                                    />
                                </div>
                                <div>
                                    <label
                                        className="block text-sm font-medium mb-1"
                                        htmlFor="node-label"
                                    >
                                        Name
                                    </label>
                                    <input
                                        id="node-label"
                                        type="text"
                                        name="label"
                                        value={editedData.label || ''}
                                        onChange={handleInputChange}
                                        className="input input-bordered w-full mt-1"
                                        placeholder="Enter node name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-light" htmlFor="node-type">
                                        Node Type
                                    </label>
                                    <input
                                        id="node-type"
                                        type="text"
                                        name="type"
                                        value={editedData.type || ''}
                                        onChange={handleInputChange}
                                        className="input input-bordered w-full mt-1"
                                        placeholder="Enter node type"
                                    />
                                </div>
                                <div>
                                    <label
                                        className="block text-sm font-light"
                                        htmlFor="node-description"
                                    >
                                        Description
                                    </label>
                                    <textarea
                                        id="node-description"
                                        name="description"
                                        value={editedData.description}
                                        onChange={handleInputChange}
                                        className="textarea textarea-bordered w-full mt-1"
                                        placeholder="Enter node description"
                                    />
                                </div>
                            </>
                        )}
                        {isCALMEdge && (
                            <>
                                <div>
                                    <label className="block text-sm font-light" htmlFor="edge-id">
                                        Unique ID (read-only)
                                    </label>
                                    <input
                                        id="edge-id"
                                        type="text"
                                        name="id"
                                        value={editedData.id}
                                        readOnly
                                        className="input input-bordered w-full mt-1"
                                    />
                                </div>
                                <div>
                                    <label
                                        className="block text-sm font-light"
                                        htmlFor="edge-label"
                                    >
                                        Label
                                    </label>
                                    <input
                                        id="edge-label"
                                        type="text"
                                        name="label"
                                        value={editedData.label}
                                        onChange={handleInputChange}
                                        className="input input-bordered w-full mt-1"
                                        placeholder="Enter edge label"
                                    />
                                </div>
                                <div>
                                    <label
                                        className="block text-sm font-light"
                                        htmlFor="edge-source"
                                    >
                                        Source (read-only)
                                    </label>
                                    <input
                                        id="edge-source"
                                        type="text"
                                        name="source"
                                        value={editedData.source}
                                        readOnly
                                        className="input input-bordered w-full mt-1"
                                    />
                                </div>
                                <div>
                                    <label
                                        className="block text-sm font-light"
                                        htmlFor="edge-target"
                                    >
                                        Target (read-only)
                                    </label>
                                    <input
                                        id="edge-target"
                                        type="text"
                                        name="target"
                                        value={editedData.target}
                                        readOnly
                                        className="input input-bordered w-full mt-1"
                                    />
                                </div>
                            </>
                        )}
                        {isShell && (
                            <div className="bg-blue-50 p-3 rounded-lg mt-2">
                                <p className="text-sm text-blue-700">
                                    {isCALMNode
                                        ? 'This is a new node. Add details and save to add it to your diagram.'
                                        : 'This is a new connection. Add a label to describe the relationship.'}
                                </p>
                            </div>
                        )}
                        <div className="flex justify-end">
                            <button
                                onClick={saveChanges}
                                className="btn btn-primary flex items-center gap-2"
                                aria-label="Creat or Save changes"
                            >
                                <IoSaveOutline size={20} /> {isShell ? 'Create' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {isCALMNode && (
                            <>
                                <div className="mb-4">
                                    <p className="text-sm text-gray-500">Unique ID</p>
                                    <p className="font-medium">{selectedData.id}</p>
                                </div>
                                <div className="mb-4">
                                    <p className="text-sm text-gray-500">Name</p>
                                    <p className="font-medium">
                                        {selectedData.label || '(Unnamed)'}
                                    </p>
                                </div>
                                <div className="mb-4">
                                    <p className="text-sm text-gray-500">Type</p>
                                    <p className="font-medium">
                                        {selectedData.type || '(No type)'}
                                    </p>
                                </div>
                                <div className="mb-4">
                                    <p className="text-sm text-gray-500">Description</p>
                                    <p className="font-medium">
                                        {selectedData.description || '(No description)'}
                                    </p>
                                </div>
                            </>
                        )}

                        {isCALMEdge && (
                            <>
                                <div className="mb-4">
                                    <p className="text-sm text-gray-500">Unique ID</p>
                                    <p className="font-medium">{selectedData.id}</p>
                                </div>
                                <div className="mb-4">
                                    <p className="text-sm text-gray-500">Label</p>
                                    <p className="font-medium">
                                        {selectedData.label || '(Unlabeled)'}
                                    </p>
                                </div>
                                <div className="mb-4">
                                    <p className="text-sm text-gray-500">Source</p>
                                    <p className="font-medium">{selectedData.source}</p>
                                </div>
                                <div className="mb-4">
                                    <p className="text-sm text-gray-500">Target</p>
                                    <p className="font-medium">{selectedData.target}</p>
                                </div>
                            </>
                        )}

                        {!isCALMEdge && !isCALMNode && (
                            <div className="text-xl font-bold mb-2">Unknown Selected Entity</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default Sidebar;
