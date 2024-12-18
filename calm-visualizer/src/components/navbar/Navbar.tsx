import React from 'react';
import { CALMInstantiation } from '../../../../shared/src';

interface NavbarProps {
    handleUpload: (instanceFile: File) => void;
    toggleDescriptions: () => void;
    calmInstance?: CALMInstantiation;
}

function Navbar({ handleUpload, toggleDescriptions, calmInstance }: NavbarProps) {
    const upload = (file: File) => {
        handleUpload(file);
    };

    return (
        <div className="navbar bg-base-300">
            <div className="flex-1">
                <a className="btn btn-ghost text-xl">CALM</a>
            </div>
            <div className="flex-none">
                <ul className="menu menu-horizontal px-1">
                    <li>
                        <details>
                            <summary>Upload</summary>
                            <ul className="p-2 z-1">
                                <li>
                                    <label>
                                        Architecture
                                        <input
                                            id="file"
                                            type="file"
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
                <div className="toggles">
                    {calmInstance && (
                        <label className="label cursor-pointer">
                            <span className="label-text">Connection Descriptions</span>
                            <input
                                type="checkbox"
                                className="toggle"
                                onClick={toggleDescriptions}
                            />
                        </label>
                    )}
                </div>
            </div>
        </div>
    );
}
export default Navbar;
