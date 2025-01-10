import React from 'react';

interface NavbarProps {
    handleUpload: (instanceFile: File) => void;
    isGraphRendered: boolean;
    toggleConnectionDesc: () => void;
    toggleNodeDesc: () => void;
}

function Navbar({
    handleUpload,
    isGraphRendered,
    toggleConnectionDesc,
    toggleNodeDesc,
}: NavbarProps) {
    const upload = (file: File) => {
        handleUpload(file);
    };

    return (
        <div className="navbar bg-base-300">
            <div className="flex-1">
                <a className="btn btn-ghost text-xl">CALM</a>
                <div className="divider divider-horizontal"></div>
                <span className="text-lg">Visualizer</span>
            </div>
            <div className="flex-none">
                <ul className="menu menu-horizontal px-1" aria-label="navbar-menu-items">
                    <li>
                        <details>
                            <summary>Upload</summary>
                            <ul className="p-2 z-1" aria-label="upload-dropdown-items">
                                <li>
                                    <label>
                                        Architecture
                                        <input
                                            id="file"
                                            type="file"
                                            aria-label="upload-architecture"
                                            className="hidden"
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                                e.target.files && upload(e.target.files[0])
                                            }
                                        />
                                    </label>
                                </li>
                            </ul>
                        </details>
                    </li>
                </ul>

                {isGraphRendered && (
                    <>
                        <div className="divider divider-horizontal"></div>
                        <div className="toggles menu-horizontal">
                            <label className="label cursor-pointer">
                                <span className="label label-text">Connection Descriptions</span>
                                <input
                                    type="checkbox"
                                    className="toggle"
                                    name="connection-description"
                                    aria-label="connection-description"
                                    onClick={toggleConnectionDesc}
                                />
                            </label>
                            <label className="label cursor-pointer">
                                <span className="label label-text">Node Descriptions</span>
                                <input
                                    type="checkbox"
                                    className="toggle"
                                    aria-label="node-description"
                                    onClick={toggleNodeDesc}
                                />
                            </label>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
export default Navbar;
