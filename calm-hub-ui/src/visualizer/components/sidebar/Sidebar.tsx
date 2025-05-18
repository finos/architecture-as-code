import { IoAddOutline, IoCloseOutline, IoRemoveOutline } from 'react-icons/io5';
import { useState } from 'react';
import { CalmNode, Edge } from '../../contracts/contracts.js';

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
                        isInterfacesVisible={isInterfacesVisible}
                        toggleInterfacesVisibility={toggleInterfacesVisibility}
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

function NodeDisplay({
    selectedData,
    isInterfacesVisible,
    toggleInterfacesVisibility,
}: {
    selectedData: CalmNode['data'];
    isInterfacesVisible: boolean;
    toggleInterfacesVisibility: () => void;
}) {
    return (
        <div className="max-w-full">
            <div className="text-xl font-bold mb-2">Node Details</div>
            <div className="h-full overflow-y-auto">
                <div className="node-details">
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
                </div>
                {selectedData.interfaces && (
                    <div className="interfaces">
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
                        </div>
                        {isInterfacesVisible && (
                            <div>
                                {selectedData.interfaces.map((interfaceItem) => (
                                    <div className="ml-4 border-b border-gray-300 pb-4">
                                        <div>
                                            {Object.entries(interfaceItem).map(([key, value]) => (
                                                <div key={key} className="flex cursor-default">
                                                    <span className="font-light">{key}: </span>
                                                    <span className="font-semibold">
                                                        {String(value)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                {selectedData.controls && (
                    <div className="h-full controls max-w-full">
                        <div className="flex items-center justify-between">
                            <span className="font-light">controls: </span>
                            <button
                                aria-label="toggle-controls"
                                onClick={toggleInterfacesVisibility}
                                className="ml-auto btn btn-xs btn-outline"
                            >
                                {isInterfacesVisible ? (
                                    <IoRemoveOutline size={16} />
                                ) : (
                                    <IoAddOutline size={16} />
                                )}
                            </button>
                        </div>
                        {isInterfacesVisible && (
                            <div>
                                {Object.entries(selectedData.controls).map(
                                    ([controlId, controlValue]) => (
                                        <div
                                            key={controlId}
                                            className="pl-4 border-b border-gray-300 pb-4 break-words"
                                        >
                                            <div>
                                                <div className="flex flex-wrap">
                                                    <span className="font-light">
                                                        {controlId}:{' '}
                                                    </span>
                                                    <span className="font-semibold pl-2 truncate whitespace-normal">
                                                        {typeof controlValue === 'object' &&
                                                        controlValue !== null ? (
                                                            <ControlDisplay
                                                                control={controlValue}
                                                            />
                                                        ) : (
                                                            String(controlValue)
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function EdgeDisplay({ selectedData }: { selectedData: Edge['data'] }) {
    return (
        <>
            <div className="text-xl font-bold mb-2">Edge Details</div>
            <div>
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
        </>
    );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ControlDisplay({ control }: { control: any }) {
    const [isExpanded, setIsExpanded] = useState(true);

    const toggleExpand = () => {
        setIsExpanded((prev) => !prev);
    };

    if (Array.isArray(control)) {
        return (
            <div className="pl-2">
                <div className="flex items-center justify-between">
                    <button
                        aria-label="toggle-array"
                        onClick={toggleExpand}
                        className="ml-auto btn btn-xs btn-outline"
                    >
                        {isExpanded ? <IoRemoveOutline size={16} /> : <IoAddOutline size={16} />}
                    </button>
                </div>
                {isExpanded && (
                    <ul className="list-disc pointer-events-none">
                        {control.map((item, index) => (
                            <li key={index} className="block">
                                {typeof item === 'object' && item !== null ? (
                                    <ul className="list-none">
                                        {Object.entries(item).map(([key, value]) => (
                                            <li key={key}>
                                                <div className="flex flex-wrap w-full">
                                                    <span className="font-light">{key}: </span>
                                                    <span className="font-semibold pl-2 break-words w-full">
                                                        {typeof value === 'object' &&
                                                        value !== null ? (
                                                            <ControlDisplay control={value} />
                                                        ) : (
                                                            String(value)
                                                        )}
                                                    </span>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <span className="font-semibold">{String(item)}</span>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        );
    } else if (typeof control === 'object' && control !== null) {
        return (
            <div className="pl-2">
                {Object.entries(control).map(([key, value]) => (
                    <div key={key} className="flex flex-wrap">
                        <div className="flex">
                            <span className="font-light">{key}: </span>
                            {typeof value !== 'object' || value === null ? (
                                <span className="font-semibold pl-2 truncate whitespace-normal">
                                    {String(value)}
                                </span>
                            ) : null}
                        </div>
                        {typeof value === 'object' && value !== null && (
                            <div className="pl-2 w-full">
                                <ControlDisplay control={value} />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        );
    }
    return <span className="truncate">{String(control)}</span>;
}
