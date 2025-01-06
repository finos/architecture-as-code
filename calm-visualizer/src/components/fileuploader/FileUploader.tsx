import React, { useState } from 'react'

interface FileUploaderProps {
    callback: (instanceFile: File, layoutFile?: File) => void
}

function FileUploader({ callback }: FileUploaderProps) {
    const [instanceFile, setInstanceFile] = useState<File | null>(null)
    const [layoutFile, setLayoutFile] = useState<File | null>(null)

    const handleSubmit = () => {
        if (instanceFile) {
            callback(instanceFile, layoutFile || undefined)
        }
    }

    return (
        <>
            <div className="input-group">
                <div
                    style={{
                        display: 'flex',
                    }}
                >
                    <div>
                        <p>CALM Instance:</p>
                        <input
                            id="file"
                            type="file"
                            className="file-input w-full max-w-xs"
                            onChange={(
                                e: React.ChangeEvent<HTMLInputElement>
                            ) =>
                                e.target.files &&
                                setInstanceFile(e.target.files[0])
                            }
                        />
                    </div>
                    <div>
                        <p>Layout File:</p>
                        <input
                            id="file"
                            type="file"
                            className="file-input w-full max-w-xs"
                            onChange={(
                                e: React.ChangeEvent<HTMLInputElement>
                            ) =>
                                e.target.files &&
                                setLayoutFile(e.target.files[0])
                            }
                        />
                    </div>
                </div>
            </div>
            {instanceFile && (
                <button onClick={handleSubmit} className="btn">
                    Visualize
                </button>
            )}
        </>
    )
}

export default FileUploader
