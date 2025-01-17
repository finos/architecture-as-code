import './Navbar.css'
import React, { useContext } from 'react';
import { ZoomContext } from '../zoom-context.provider';

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
    const { zoomLevel, updateZoom } = useContext(ZoomContext);

    function zoomIn() {
        //Obtain percentage as integer
        const currentPercentageZoom = Math.round(zoomLevel*100);
        //Add 10% to the zoom or round to upper 10% interval
        const newPercentageZoom = Math.floor(currentPercentageZoom/10)*10 + 10;
        updateZoom(newPercentageZoom/100);
    }

    function zoomOut() {
        //Obtain percentage as integer
        const currentPercentageZoom = Math.round(zoomLevel*100);
        //Subtract 10% from the zoom or round to lower 10% interval - but not less than zero
        const newPercentageZoom = Math.max(Math.ceil(currentPercentageZoom/10)*10 - 10, 0);
        updateZoom(newPercentageZoom/100);
    }

    return (
        <div className="navbar bg-secondary text-secondary-content">
            <div className="flex-1">
                <a className="btn btn-ghost text-2xl">CALM</a>
                <div className="divider divider-horizontal"></div>
                <span className="text-lg font-thin">Visualizer</span>
            </div>
            <div className="flex-none">
                <ul className="menu menu-horizontal px-1" aria-label="navbar-menu-items">
                    <li>
                        <details>
                            <summary>Upload</summary>
                            <ul className="p-2 z-1" aria-label="upload-dropdown-items">
                                <li className=" text-secondary">
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
                            <div className="label">
                                <span className="label label-text">Zoom: {(zoomLevel*100).toFixed(0)}%</span>
                                <button className='ms-1 ps-2 pe-2 zoom-button' onClick={zoomIn}>+</button>
                                <button className='ms-1 ps-2 pe-2 zoom-button' onClick={zoomOut}>-</button>
                            </div> 
                            <label className="label cursor-pointer">
                                <span className="label label-text text-secondary-content">
                                    Connection Descriptions
                                </span>
                                <input
                                    type="checkbox"
                                    className="toggle"
                                    name="connection-description"
                                    aria-label="connection-description"
                                    onClick={toggleConnectionDesc}
                                />
                            </label>
                            <label className="label cursor-pointer">
                                <span className="label label-text text-secondary-content">
                                    Node Descriptions
                                </span>
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
