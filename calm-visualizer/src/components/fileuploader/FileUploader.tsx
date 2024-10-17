import React, { useState } from 'react';

interface Props {
    callback: (instanceFile: File, layoutFile?: File) => void
}

function FileUploader({ callback }: Props) {
    const [instanceFile, setInstanceFile] = useState<File | null>(null);
    const [layoutFile, setLayoutFile] = useState<File | null>(null);

    const handleSubmit = () => {
        if (instanceFile) {
            callback(instanceFile, layoutFile || undefined);
        }
    };

  return (
    <>
      <div className="input-group">
        <div style={{
            display: 'flex'
        }}>
            <div>
                <p>CALM Instance:</p>
                <input id="file" type="file" onChange={(e: React.ChangeEvent<HTMLInputElement>) => e.target.files && setInstanceFile(e.target.files[0])} />
            </div>

            <div>
                <p>Layout File:</p>
                <input id="file" type="file" onChange={(e: React.ChangeEvent<HTMLInputElement>) => e.target.files && setLayoutFile(e.target.files[0])} />
            </div>
        </div>
      </div>
      {instanceFile && (
        <button 
          onClick={handleSubmit}
          className="submit"
        >Upload a file</button>
      )}
    </>
  );
};

export default FileUploader;