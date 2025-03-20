import './Sidebar.css';
import { IoCloseOutline, IoPencil, IoSaveOutline, IoTrashOutline } from 'react-icons/io5';
import { Edge, Node } from '../cytoscape-renderer/CytoscapeRenderer.js';
import { useEffect, useState } from 'react';

interface SidebarProps {
    selectedData: Node['data'] | Edge['data'];
    closeSidebar: () => void;
    updateElement: (updatedData: Node['data'] | Edge['data']) => void;
    deleteElement: (elementId: string) => void;
    nodes: Node[]; // Added to access all nodes for the edge creation dropdown
    createEdge: (sourceId: string, targetId: string, label: string) => void;
}

function isCALMNodeData(data: Node['data'] | Edge['data']): data is Node['data'] {
    return data.id != null && data.type != null;
}

function isCALMEdgeData(data: Node['data'] | Edge['data']): data is Edge['data'] {
    return data.id != null && data.source != null && data.target != null;
}

function Sidebar({
    selectedData,
    closeSidebar,
    updateElement,
    deleteElement,
    nodes,
    createEdge,
}: SidebarProps) {
    // Determine if we have selected a node or edge or something else
    const isCALMNode = isCALMNodeData(selectedData);
    const isCALMEdge = isCALMEdgeData(selectedData);

    const isShell = selectedData.isShell === true;

    const [isEditMode, setIsEditMode] = useState(isShell);
    const [editedData, setEditedData] = useState<Node['data'] | Edge['data']>({ ...selectedData });

    const [targetNodeId, setTargetNodeId] = useState<string>('');
    const [newEdgeLabel, setNewEdgeLabel] = useState<string>('New Connection');

    const [keepConnectionPanelOpen, setKeepConnectionPanelOpen] = useState(false);

    // Reset the edited data when the selected data changes
    useEffect(() => {
        setEditedData({ ...selectedData });
        setIsEditMode(selectedData.isShell === true);

        if (!keepConnectionPanelOpen) {
            setTargetNodeId('');
            setNewEdgeLabel('New Connection');
        }

        // Reset flag when changing selection
        setKeepConnectionPanelOpen(false);
    }, [selectedData, keepConnectionPanelOpen]);

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

        if (isShell && isCALMNode) {
            setKeepConnectionPanelOpen(true);
        }
    };

    const handleDelete = () => {
        deleteElement(selectedData.id);
        closeSidebar();
    };

    const handleCreateEdge = () => {
        if (targetNodeId) {
            createEdge(selectedData.id, targetNodeId, newEdgeLabel);
            // Reset form
            setTargetNodeId('');
            setNewEdgeLabel('New Connection');

            setKeepConnectionPanelOpen(true);
        }
    };

    // Function to render edge creation panel
    const renderEdgeCreationPanel = () => {
        if (!isCALMNode || isEditMode || isShell) return null;

        // Filter out current node and shell nodes for dropdown
        const availableTargetNodes = nodes.filter(
            (node) => node.data.id !== selectedData.id && !node.data.isShell
        );

        if (availableTargetNodes.length === 0) {
            return (
                <div className="mt-6 p-3 border border-blue-200 rounded-lg bg-blue-50">
                    <h3 className="font-medium text-blue-800 mb-2">Create Connection</h3>
                    <p className="text-sm text-gray-600">
                        No other nodes available to connect to. Create more nodes first.
                    </p>
                </div>
            );
        }

        return (
            <div className="mt-6 p-3 border border-blue-200 rounded-lg bg-blue-50">
                <h3 className="font-medium text-blue-800 mb-2">Create Connection</h3>

                <div className="space-y-3">
                    <div>
                        <label className="block text-sm text-gray-600">Connect to node:</label>
                        <select
                            className="select select-bordered w-full mt-1"
                            value={targetNodeId}
                            onChange={(e) => setTargetNodeId(e.target.value)}
                            aria-label="Dropdown for node selection"
                        >
                            <option value="" disabled>
                                Select a target node
                            </option>
                            {availableTargetNodes.map((node) => (
                                <option key={node.data.id} value={node.data.id}>
                                    {node.data.label || node.data.id}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm text-gray-600">Connection label:</label>
                        <input
                            type="text"
                            className="input input-bordered w-full mt-1"
                            value={newEdgeLabel}
                            onChange={(e) => setNewEdgeLabel(e.target.value)}
                            placeholder="Describe the connection"
                        />
                    </div>

                    <div className="flex justify-between mt-2">
                        <button
                            className="btn btn-sm btn-primary"
                            onClick={handleCreateEdge}
                            disabled={!targetNodeId}
                        >
                            Create Connection
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const canEditID = isCALMNode && selectedData.isShell === true;
    const isNewlyCreated =
        selectedData.id.startsWith('node-') || selectedData.id.startsWith('edge-');
    return (
        <div className="right-0 h-screen w-80 bg-base-300">
            <label
                htmlFor="node-details"
                className="drawer-overlay h-screen"
                onClick={closeSidebar}
            ></label>
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
                    <div className="space-y-4 edit-fields">
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
                                        disabled={!canEditID}
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
                                        disabled={true}
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
                                        disabled={true}
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
                                        disabled={true}
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

                        <div className="flex justify-end mt-4">
                            <button
                                onClick={handleDelete}
                                className="btn btn-error flex items-center gap-2 mr-2"
                                aria-label="Delete element"
                            >
                                <IoTrashOutline size={20} /> Delete
                            </button>

                            {isEditMode && (
                                <button
                                    onClick={saveChanges}
                                    className="btn btn-primary flex items-center gap-2 ml-2"
                                    aria-label="Create or Save changes"
                                >
                                    <IoSaveOutline size={20} />
                                    {isShell ? 'Create' : 'Save Changes'}
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3 non-edit-fields">
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
                                {renderEdgeCreationPanel()}
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

                        <div className="flex justify-between mt-4">
                            {isNewlyCreated && (
                                <button
                                    onClick={handleDelete}
                                    className="btn btn-error flex items-center gap-2"
                                    aria-label="Delete element"
                                >
                                    <IoTrashOutline size={20} /> Delete
                                </button>
                            )}

                            <button
                                onClick={() => setIsEditMode(true)}
                                className="btn btn-primary flex items-center gap-2 ${isNewlyCreated ? '' : 'w-full'}`}"
                                aria-label="Edit element"
                            >
                                <IoPencil size={20} /> Edit
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Sidebar;
