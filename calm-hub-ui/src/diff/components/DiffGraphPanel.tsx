import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import type { DiffGraphPanelProps } from '../model/diff-ui-types.js';
import '../Diff.css';
import { DiffGraph } from './DiffGraph.js';

export function DiffGraphPanel({ archA, archB, diffResult, onFileLoad }: DiffGraphPanelProps) {
    const onDropA = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles[0]) {
            onFileLoad(acceptedFiles[0], true);
        }
    }, [onFileLoad]);

    const onDropB = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles[0]) {
            onFileLoad(acceptedFiles[0], false);
        }
    }, [onFileLoad]);

    const { getRootProps: getRootPropsA, getInputProps: getInputPropsA, isDragActive: isDragActiveA } = useDropzone({
        onDrop: onDropA,
        accept: { 'application/json': ['.json'] },
        multiple: false
    });

    const { getRootProps: getRootPropsB, getInputProps: getInputPropsB, isDragActive: isDragActiveB } = useDropzone({
        onDrop: onDropB,
        accept: { 'application/json': ['.json'] },
        multiple: false
    });

    return (
        <div className="diff-graph-panel">
            {!archA && !archB ? (
                <div className="file-upload-area">
                    <h3 className="text-lg font-semibold mb-4">CALM Architecture Diff</h3>
                    <p className="text-gray-600 mb-6">
                        Upload two CALM architecture JSON files to compare them and see the differences.
                    </p>
                    <div className="flex gap-8">
                        <div
                            {...getRootPropsA()}
                            className={`file-upload-area flex-1 ${isDragActiveA ? 'drag-active' : ''}`}
                        >
                            <input {...getInputPropsA()} />
                            <div className="file-upload-label">
                                <div className="text-sm font-medium mb-2">First Architecture</div>
                                <div className="text-xs text-gray-500">
                                    {isDragActiveA ? 'Drop the file here' : 'Click to upload or drag & drop'}
                                </div>
                            </div>
                        </div>
                        <div
                            {...getRootPropsB()}
                            className={`file-upload-area flex-1 ${isDragActiveB ? 'drag-active' : ''}`}
                        >
                            <input {...getInputPropsB()} />
                            <div className="file-upload-label">
                                <div className="text-sm font-medium mb-2">Second Architecture</div>
                                <div className="text-xs text-gray-500">
                                    {isDragActiveB ? 'Drop the file here' : 'Click to upload or drag & drop'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="architectures-container">
                    <div className="architecture-panel">
                        <div className="architecture-header">
                            {archA ? `Architecture A: ${archA.metadata?.name || 'Unnamed'}` : 'Architecture A - Upload a file'}
                        </div>
                        <div className="architecture-graph">
                            {archA ? (
                                <DiffGraph
                                    architecture={archA}
                                    diffResult={diffResult}
                                    isFirst={true}
                                />
                            ) : (
                                <div
                                    {...getRootPropsA()}
                                    className={`file-upload-area h-full m-0 rounded-none ${isDragActiveA ? 'drag-active' : ''}`}
                                >
                                    <input {...getInputPropsA()} />
                                    <div className="file-upload-label">
                                        <div className="text-sm font-medium mb-2">Upload First Architecture</div>
                                        <div className="text-xs text-gray-500">
                                            {isDragActiveA ? 'Drop the file here' : 'Click to upload or drag & drop'}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="architecture-panel">
                        <div className="architecture-header">
                            {archB ? `Architecture B: ${archB.metadata?.name || 'Unnamed'}` : 'Architecture B - Upload a file'}
                        </div>
                        <div className="architecture-graph">
                            {archB ? (
                                <DiffGraph
                                    architecture={archB}
                                    diffResult={diffResult}
                                    isFirst={false}
                                />
                            ) : (
                                <div
                                    {...getRootPropsB()}
                                    className={`file-upload-area h-full m-0 rounded-none ${isDragActiveB ? 'drag-active' : ''}`}
                                >
                                    <input {...getInputPropsB()} />
                                    <div className="file-upload-label">
                                        <div className="text-sm font-medium mb-2">Upload Second Architecture</div>
                                        <div className="text-xs text-gray-500">
                                            {isDragActiveB ? 'Drop the file here' : 'Click to upload or drag & drop'}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
