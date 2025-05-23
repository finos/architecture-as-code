import { IoAddOutline, IoCloseOutline, IoRemoveOutline } from 'react-icons/io5';
import { useState } from 'react';
import { CalmNode, Edge } from '../../contracts/contracts.js';
import { EdgeDisplay } from './EdgeDisplay.js';
import { NodeDisplay } from './NodeDisplay.js';

export interface SidebarProps {
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
    const [isDetailsExpanded, setDetailsExpanded] = useState(true);

    const toggleDetailsVisibility = () => {
        setDetailsExpanded((prev) => !prev);
    };

    const isCALMNode = isCALMNodeData(selectedData);
    const isCALMEdge = isCALMEdgeData(selectedData);

    return (
        <div className="fixed right-0 h-full w-90 bg-base-300 shadow-lg">
            <label htmlFor="node-details" className="drawer-overlay" onClick={closeSidebar}></label>
            <div className="menu bg-base-300 text-base-content h-full w-90 p-4">
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
                    <NodeDisplay
                        selectedData={selectedData}
                        isDetailsExpanded={isDetailsExpanded}
                        toggleDetailsVisibility={toggleDetailsVisibility}
                    />
                )}
                {isCALMEdge && <EdgeDisplay selectedData={selectedData} />}

                {!isCALMEdge && !isCALMNode && (
                    <div className="text-xl font-bold mb-2">Unknown Selected Entity</div>
                )}
            </div>
        </div>
    );
}
