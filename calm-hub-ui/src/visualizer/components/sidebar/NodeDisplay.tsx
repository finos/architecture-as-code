import { IoAddOutline, IoRemoveOutline } from 'react-icons/io5';
import { CalmNode } from '../../contracts/contracts.js';
import { ControlDisplay } from './ControlDisplay.js';

export function NodeDisplay({
    selectedData,
    isDetailsExpanded,
    toggleDetailsVisibility,
}: {
    selectedData: CalmNode['data'];
    isDetailsExpanded: boolean;
    toggleDetailsVisibility: () => void;
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
                                onClick={toggleDetailsVisibility}
                                className="ml-auto btn btn-xs btn-outline"
                            >
                                {isDetailsExpanded ? (
                                    <IoRemoveOutline size={16} />
                                ) : (
                                    <IoAddOutline size={16} />
                                )}
                            </button>
                        </div>
                        {isDetailsExpanded && (
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
                                onClick={toggleDetailsVisibility}
                                className="ml-auto btn btn-xs btn-outline"
                            >
                                {isDetailsExpanded ? (
                                    <IoRemoveOutline size={16} />
                                ) : (
                                    <IoAddOutline size={16} />
                                )}
                            </button>
                        </div>
                        {isDetailsExpanded && (
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
