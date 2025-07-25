import { useRef } from 'react';
import { useState } from 'react';

interface MenuProps {
    handleUpload: (instanceFile: File) => void;
}

export function Menu({ handleUpload }: MenuProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [fileUploaded, setFileUploaded] = useState<File | null>(null);

    const upload = (file: File) => {
        handleUpload(file);
        setFileUploaded(file);
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
            <div className="mx-auto max-w-7xl flex justify-end items-center">
                <div className="menu-end">
                    {!fileUploaded && (
                        <button
                            className="m-2 btn btn-outline btn-primary"
                            onClick={handleUploadBtnClick}
                        >
                            Upload Architecture
                        </button>
                    )}
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
