import React from 'react';

interface FileUploaderProps {
    callback: (instanceFile: File) => void;
}

function FileUploader({ callback }: FileUploaderProps) {
    const handleSubmit = (file: File) => {
        callback(file);
    };

    return (
        <>
            <div className="input-group m-5">
                <div
                    style={{
                        display: 'flex',
                    }}
                >
                    <div>
                        <input
                            id="file"
                            type="file"
                            className="file-input w-full max-w-xs"
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                e.target.files && handleSubmit(e.target.files[0])
                            }
                        />
                    </div>
                </div>
            </div>
        </>
    );
}

export default FileUploader;
