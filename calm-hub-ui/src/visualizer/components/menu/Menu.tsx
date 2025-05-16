import React from 'react';

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

    return (
        <header className="bg-white shadow-xs">
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
                                    onChange={toggleConnectionDesc}
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
                                    onChange={toggleNodeDesc}
                                />
                            </label>
                        </>
                    )}
                </div>
                <div className="menu-end">
                    <ul className="menu menu-horizontal px-1" aria-label="navbar-menu-items">
                        <li>
                            <details>
                                <summary>Upload</summary>
                                <ul className="p-2 z-1" aria-label="upload-dropdown-items">
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
