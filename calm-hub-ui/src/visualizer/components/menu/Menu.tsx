import { useRef } from 'react';

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
    const inputRef = useRef<HTMLInputElement>(null);
    const upload = (file: File) => {
        handleUpload(file);
    };

    const handleFileChange = (event: { target: { files: FileList | null } }) => {
        if (event.target.files) {
            const file = event.target.files[0];
            upload(file);
        }
    };

    const handleUploadBtnClick = () => {
        inputRef?.current?.click();
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
                    <button className="m-2 btn btn-outline" onClick={handleUploadBtnClick}>
                        Upload Architecture
                    </button>
                    <input
                        hidden
                        id="file"
                        data-testid="file-input"
                        type="file"
                        aria-label="upload-architecture"
                        className="hidden"
                        ref={inputRef}
                        onChange={handleFileChange}
                    />
                </div>
            </div>
        </header>
    );
}
