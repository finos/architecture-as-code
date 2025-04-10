import React, { useContext } from 'react';
import { ZoomContext } from '../zoom-context.provider.js';

interface MenuProps {
    handleUpload: (instanceFile: File) => void;
    isGraphRendered: boolean;
    toggleConnectionDesc: () => void;
    toggleNodeDesc: () => void;
    isConDescActive?: boolean;
    isNodeDescActive?: boolean;
}

export function Menu({
    handleUpload,
    isGraphRendered,
    toggleConnectionDesc,
    toggleNodeDesc,
    isConDescActive,
    isNodeDescActive,
}: MenuProps) {
    const upload = (file: File) => {
        handleUpload(file);
    };
    const { zoomLevel, updateZoom } = useContext(ZoomContext);

    function zoomIn() {
        //Obtain percentage as integer
        const currentPercentageZoom = Math.round(zoomLevel * 100);
        //Add 10% to the zoom or round to upper 10% interval
        const newPercentageZoom = Math.floor(currentPercentageZoom / 10) * 10 + 10;
        updateZoom(newPercentageZoom / 100);
    }

    function zoomOut() {
        //Obtain percentage as integer
        const currentPercentageZoom = Math.round(zoomLevel * 100);
        //Subtract 10% from the zoom or round to lower 10% interval - but not less than zero
        const newPercentageZoom = Math.max(Math.ceil(currentPercentageZoom / 10) * 10 - 10, 0);
        updateZoom(newPercentageZoom / 100);
    }

    return (
        <header className="bg-white shadow-sm">
            <div className="mx-auto max-w-7xl flex justify-between items-center">
                <div className="flex items-center space-x-4">
                    {isGraphRendered && (
                        <>
                            <label className="label cursor-pointer">
                                <span className="label label-text text-base-content">
                                    Relationship Descriptions
                                </span>
                                <input
                                    type="checkbox"
                                    className="toggle"
                                    name="connection-description"
                                    aria-label="connection-description"
                                    checked={isConDescActive}
                                    onClick={toggleConnectionDesc}
                                />
                            </label>
                            <label className="label cursor-pointer">
                                <span className="label label-text text-base-content">
                                    Node Descriptions
                                </span>
                                <input
                                    type="checkbox"
                                    className="toggle"
                                    aria-label="node-description"
                                    checked={isNodeDescActive}
                                    onClick={toggleNodeDesc}
                                />
                            </label>
                        </>
                    )}
                </div>
                <div className="flex-1 flex justify-center">
                    {isGraphRendered && (
                        <div className="flex items-center space-x-4">
                            <div className="label">
                                <span className="label label-text text-base-content">
                                    Zoom: {(zoomLevel * 100).toFixed(0)}%
                                </span>
                                <button
                                    className={`btn btn-xs ms-1 ps-2 pe-2 ${zoomLevel >= 5 ? 'btn-disabled' : ''}`}
                                    onClick={zoomIn}
                                    disabled={zoomLevel >= 5}
                                >
                                    +
                                </button>
                                <button
                                    className={`btn btn-xs ms-1 ps-2 pe-2 ${zoomLevel <= 0.1 ? 'btn-disabled' : ''}`}
                                    onClick={zoomOut}
                                    disabled={zoomLevel <= 0.1}
                                >
                                    -
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                <div className="menu-end">
                    <ul className="menu menu-horizontal px-1" aria-label="navbar-menu-items">
                        <li>
                            <details>
                                <summary>Upload</summary>
                                <ul className="p-2 z-1 position-absolute end-0" aria-label="upload-dropdown-items">
                                    <li className="text-base-content">
                                        <label>
                                            Architecture
                                            <input
                                                id="file"
                                                type="file"
                                                aria-label="upload-architecture"
                                                className="hidden"
                                                onChange={(
                                                    e: React.ChangeEvent<HTMLInputElement>
                                                ) => e.target.files && upload(e.target.files[0])}
                                            />
                                        </label>
                                    </li>
                                </ul>
                            </details>
                        </li>
                    </ul>
                </div>
            </div>
        </header>
    );
}
