import { IoCloseOutline } from 'react-icons/io5';
import { NodeData, EdgeData } from '../../contracts/contracts.js';
import { JsonRenderer } from '../../../hub/components/json-renderer/JsonRenderer.js';
import type { SidebarProps } from '../../contracts/visualizer-contracts.js';

function isNodeData(data: NodeData | EdgeData): data is NodeData {
    return data['unique-id'] != null && 'node-type' in data && data['node-type'] != null;
}

function isEdgeData(data: NodeData | EdgeData): data is EdgeData {
    return data['unique-id'] != null && 'relationship-type' in data && !('node-type' in data);
}

export function Sidebar({ selectedData, closeSidebar }: SidebarProps) {
    const isCALMNode = isNodeData(selectedData);
    const isCALMEdge = isEdgeData(selectedData);

    return (
        <div className="fixed right-0 h-full w-96 bg-base-200 shadow-2xl flex flex-col">
            <label htmlFor="node-details" className="drawer-overlay" onClick={closeSidebar}></label>

            {/* Header */}
            <div className="bg-base-100 border-b border-base-300 p-4 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div
                        className="w-1 h-6 rounded-full"
                        style={{ backgroundColor: 'var(--color-accent)' }}
                    ></div>
                    <h2 className="text-lg font-semibold text-base-content">
                        {isCALMNode
                            ? 'Node Details'
                            : isCALMEdge
                              ? 'Relationship Details'
                              : 'Details'}
                    </h2>
                </div>
                <button
                    aria-label="close-sidebar"
                    onClick={(e) => {
                        e.stopPropagation();
                        closeSidebar();
                    }}
                    className="btn btn-ghost btn-sm btn-circle hover:bg-base-300"
                >
                    <IoCloseOutline size={20} />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col p-4 min-h-0">
                {(isCALMNode || isCALMEdge) ? (
                    <div className="flex-1 bg-base-100 rounded-lg border border-base-300 overflow-auto shadow-sm min-h-0">
                        <JsonRenderer json={selectedData} showLineNumbers={false} />
                    </div>
                ) : (
                    <div className="flex items-center justify-center flex-1 text-base-content/60">
                        <p>Unknown Selected Entity</p>
                    </div>
                )}
            </div>
        </div>
    );
}
