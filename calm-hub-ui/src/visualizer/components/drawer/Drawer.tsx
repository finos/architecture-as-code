import { useCallback, useEffect, useState } from 'react';
import {
    CalmArchitectureSchema,
    CalmNodeSchema,
    CalmRelationshipSchema,
} from '../../../../../calm-models/src/types/core-types.js';
import { Data } from '../../../model/calm.js';
import { useDropzone } from 'react-dropzone';
import { ReactFlowVisualizer } from '../reactflow/ReactFlowVisualizer.js';
import { Sidebar } from '../sidebar/Sidebar.js';
import { NodeData, EdgeData } from '../../contracts/contracts.js';

interface DrawerProps {
    data?: Data; // Optional data prop passed in from CALM Hub if user navigates from there
}

// Selected item can be either node or edge data from the graph
type SelectedItem = {
    data: NodeData | EdgeData;
} | null;

export function Drawer({ data }: DrawerProps) {
    const [title, setTitle] = useState<string>('');
    const [calmInstance, setCALMInstance] = useState<CalmArchitectureSchema | undefined>(undefined);
    const [fileInstance, setFileInstance] = useState<CalmArchitectureSchema | undefined>(undefined);
    const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);

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
        setCALMInstance(fileInstance ?? data?.data);
    }, [fileInstance, data]);

    function closeSidebar() {
        setSelectedItem(null);
    }

    // Handle node click - convert CalmNodeSchema to NodeData format
    const handleNodeClick = (nodeData: CalmNodeSchema) => {
        setSelectedItem({
            data: {
                id: nodeData['unique-id'],
                type: nodeData['node-type'] || 'unknown',
                name: nodeData.name,
                description: nodeData.description,
                interfaces: nodeData.interfaces,
                controls: nodeData.controls,
            } as NodeData,
        });
    };

    // Handle edge click - convert relationship data to EdgeData format
    const handleEdgeClick = (edgeData: CalmRelationshipSchema) => {
        const connects = edgeData['relationship-type']?.connects;
        setSelectedItem({
            data: {
                id: edgeData['unique-id'],
                source: connects?.source?.node || '',
                target: connects?.destination?.node || '',
                description: edgeData.description,
                protocol: edgeData.protocol,
                controls: edgeData.controls,
            } as EdgeData,
        });
    };

    return (
        <div {...getRootProps()} className="flex-1 flex overflow-hidden h-full">
            {!calmInstance && <input {...getInputProps()} />}
            <div className={`drawer drawer-end ${selectedItem ? 'drawer-open' : ''} w-full h-full`}>
                <input
                    type="checkbox"
                    aria-label="drawer-toggle"
                    className="drawer-toggle"
                    checked={!!selectedItem}
                    onChange={closeSidebar}
                />
                <div className="drawer-content h-full">
                    {calmInstance ? (
                        <ReactFlowVisualizer
                            title={title}
                            calmData={calmInstance}
                            onNodeClick={handleNodeClick}
                            onEdgeClick={handleEdgeClick}
                            onBackgroundClick={closeSidebar}
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
                    <Sidebar selectedData={selectedItem.data} closeSidebar={closeSidebar} />
                )}
            </div>
        </div>
    );
}
