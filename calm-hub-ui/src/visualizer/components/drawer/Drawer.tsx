import { useCallback, useEffect, useState } from 'react';
import { CalmArchitectureSchema } from '../../../../../calm-models/src/types/core-types.js';
import { CytoscapeNode, CytoscapeEdge } from '../../contracts/contracts.js';
import { VisualizerContainer } from '../visualizer-container/VisualizerContainer.js';
import { Data } from '../../../model/calm.js';
import { useDropzone } from 'react-dropzone';
import { convertCalmToCytoscape } from '../../services/calm-to-cytoscape-converter.js';
import { Sidebar } from '../sidebar/Sidebar.js';

interface DrawerProps {
    data?: Data; // Optional data prop passed in from CALM Hub if user navigates from there
}

export function Drawer({ data }: DrawerProps) {
    const [title, setTitle] = useState<string>('');
    const [calmInstance, setCALMInstance] = useState<CalmArchitectureSchema | undefined>(undefined);
    const [fileInstance, setFileInstance] = useState<string | undefined>(undefined);
    const [selectedItem, setSelectedItem] = useState<CytoscapeNode | CytoscapeEdge | null>(null);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (acceptedFiles[0]) {
            setTitle(acceptedFiles[0].name);
            const fileText = await acceptedFiles[0].text();
            setFileInstance(JSON.parse(fileText));
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

    useEffect(() => {
        // Only update title from data if data exists and title wasn't already set by file upload
        if (data?.name && data?.id && data?.version) {
            setTitle(data.name + '/' + data.id + '/' + data.version);
        }
        setCALMInstance((fileInstance as CalmArchitectureSchema) ?? data?.data);
    }, [fileInstance, data]);

    function closeSidebar() {
        setSelectedItem(null);
    }

    function createStorageKey(title: string, data?: Data): string {
        if (!data || !data.name || !data.calmType || !data.id || !data.version) {
            return title;
        }
        return `${data.name}/${data.calmType}/${data.id}/${data.version}`;
    }

    const { edges, nodes } = convertCalmToCytoscape(calmInstance);

    return (
        <div {...getRootProps()} className="flex-1 flex overflow-hidden h-screen">
            {!calmInstance && <input {...getInputProps()} />}
            <div className={`drawer drawer-end ${selectedItem ? 'drawer-open' : ''} w-full`}>
                <input
                    type="checkbox"
                    aria-label="drawer-toggle"
                    className="drawer-toggle"
                    checked={!!selectedItem}
                    onChange={closeSidebar}
                />
                <div className="drawer-content">
                    {calmInstance ? (
                        <VisualizerContainer
                            title={title}
                            nodes={nodes}
                            edges={edges}
                            calmKey={createStorageKey(title, data)}
                            nodeClickedCallback={(nodeData) => setSelectedItem({ data: nodeData })}
                            edgeClickedCallback={(edgeData) => setSelectedItem({ data: edgeData })}
                            backgroundClickedCallback={closeSidebar}
                            selectedItemId={selectedItem?.data?.id}
                        />
                    ) : (
                        <div className="flex justify-center items-center h-full w-full">
                            {isDragActive ? (
                                <p>Drop your file here ...</p>
                            ) : (
                                <p>
                                    {'Drag and drop your file here or '}
                                    <span className="border-b border-dotted border-black pb-1">
                                        Browse
                                    </span>
                                </p>
                            )}
                        </div>
                    )}
                </div>
                {selectedItem && (
                    <Sidebar selectedData={selectedItem['data']} closeSidebar={closeSidebar} />
                )}
            </div>
        </div>
    );
}
