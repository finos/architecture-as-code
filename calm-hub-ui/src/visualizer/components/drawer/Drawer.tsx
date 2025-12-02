import { useCallback, useEffect, useState, useMemo } from 'react';
import {
    CalmArchitectureSchema,
    CalmNodeSchema,
    CalmRelationshipSchema,
} from '../../../../../calm-models/src/types/core-types.js';
import { Data } from '../../../model/calm.js';
import { useDropzone } from 'react-dropzone';
import { ReactFlowVisualizer } from '../reactflow/ReactFlowVisualizer.js';
import { Sidebar } from '../sidebar/Sidebar.js';
import { MetadataPanel } from '../reactflow/MetadataPanel.js';
import { NodeData, EdgeData } from '../../contracts/contracts.js';
import type { Flow } from '../reactflow/FlowsPanel.js';
import type { Control } from '../reactflow/ControlsPanel.js';

interface DrawerProps {
    data?: Data; // Optional data prop passed in from CALM Hub if user navigates from there
}

// Selected item can be either node or edge data from the graph
type SelectedItem = {
    data: NodeData | EdgeData;
} | null;

/**
 * Extract the unique-id from a CALM node or relationship
 */
function extractId(item: CalmNodeSchema | CalmRelationshipSchema): string {
    return item?.['unique-id'] || '';
}

export function Drawer({ data }: DrawerProps) {
    const [calmInstance, setCALMInstance] = useState<CalmArchitectureSchema | undefined>(undefined);
    const [fileInstance, setFileInstance] = useState<CalmArchitectureSchema | undefined>(undefined);
    const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
    const [title, setTitle] = useState<string>('');
    // Default to collapsed as per user request
    const [isMetadataCollapsed, setIsMetadataCollapsed] = useState(true);
    // Height of the metadata panel when expanded (in pixels)
    const [metadataPanelHeight, setMetadataPanelHeight] = useState(250);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (acceptedFiles[0]) {
            const fileText = await acceptedFiles[0].text();
            setFileInstance(JSON.parse(fileText));
            setTitle(acceptedFiles[0].name);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

    useEffect(() => {
        setCALMInstance(fileInstance ?? data?.data);
        // Set title from CALM Hub data if available
        if (data?.name && data?.id && data?.version) {
            setTitle(`${data.name}/${data.id}/${data.version}`);
        }
    }, [fileInstance, data]);

    // Extract flows from CALM data
    const flows = useMemo((): Flow[] => {
        const calmData = calmInstance as CalmArchitectureSchema & { flows?: Flow[] };
        return calmData?.flows || [];
    }, [calmInstance]);

    // Extract controls from CALM data (from root, nodes, and relationships)
    const controls = useMemo((): Record<string, Control> => {
        const calmData = calmInstance as CalmArchitectureSchema & { controls?: Record<string, Control> };
        if (!calmData) return {};

        const rootControls: Record<string, Control> = calmData.controls || {};
        const nodeControls: Record<string, Control> = {};
        const relationshipControls: Record<string, Control> = {};

        // Extract controls from nodes
        const nodes = calmData.nodes || [];
        nodes.forEach((node) => {
            if (node.controls) {
                const nodeId = extractId(node);
                Object.entries(node.controls).forEach(([controlId, control]) => {
                    const uniqueControlId = `${nodeId}/${controlId}`;
                    nodeControls[uniqueControlId] = {
                        ...(control as Control),
                        appliesTo: nodeId,
                        nodeName: node.name || nodeId,
                        appliesToType: 'node',
                    };
                });
            }
        });

        // Extract controls from relationships
        const relationships = calmData.relationships || [];
        relationships.forEach((relationship) => {
            if (relationship.controls) {
                const relId = extractId(relationship);
                Object.entries(relationship.controls).forEach(([controlId, control]) => {
                    const uniqueControlId = `${relId}/${controlId}`;
                    relationshipControls[uniqueControlId] = {
                        ...(control as Control),
                        appliesTo: relId,
                        relationshipDescription: relationship.description || relId,
                        appliesToType: 'relationship',
                    };
                });
            }
        });

        // Merge all control sources (root-level takes precedence)
        return { ...nodeControls, ...relationshipControls, ...rootControls };
    }, [calmInstance]);

    const hasMetadata = flows.length > 0 || Object.keys(controls).length > 0;

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

    // Handle transition click from flows panel - highlight the relationship
    const handleTransitionClick = (relationshipId: string) => {
        // Find the relationship in the CALM data
        const relationship = calmInstance?.relationships?.find((r) => r['unique-id'] === relationshipId);
        if (relationship) {
            handleEdgeClick(relationship);
        }
    };

    // Handle node click from controls panel
    const handleControlNodeClick = (nodeId: string) => {
        // Find the node in the CALM data
        const node = calmInstance?.nodes?.find((n) => n['unique-id'] === nodeId);
        if (node) {
            handleNodeClick(node);
        }
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
                <div className="drawer-content h-full flex flex-col">
                    {calmInstance ? (
                        <>
                            {title && (
                                <div
                                    style={{
                                        padding: '8px 16px',
                                        borderBottom: '1px solid #e2e8f0',
                                        backgroundColor: '#f8fafc',
                                        fontSize: '14px',
                                        fontWeight: 500,
                                        color: '#1e293b',
                                        flexShrink: 0,
                                    }}
                                >
                                    {title}
                                </div>
                            )}
                            <div
                                style={{
                                    flex: 1,
                                    minHeight: 0,
                                    ...(hasMetadata && !isMetadataCollapsed
                                        ? { height: `calc(100% - ${metadataPanelHeight}px)` }
                                        : {}),
                                }}
                            >
                                <ReactFlowVisualizer
                                    calmData={calmInstance}
                                    onNodeClick={handleNodeClick}
                                    onEdgeClick={handleEdgeClick}
                                    onBackgroundClick={closeSidebar}
                                />
                            </div>
                            {hasMetadata && (
                                <div
                                    style={{
                                        height: isMetadataCollapsed ? '48px' : `${metadataPanelHeight}px`,
                                        flexShrink: 0,
                                    }}
                                >
                                    <MetadataPanel
                                        flows={flows}
                                        controls={controls}
                                        onTransitionClick={handleTransitionClick}
                                        onNodeClick={handleControlNodeClick}
                                        isCollapsed={isMetadataCollapsed}
                                        onToggleCollapse={() => setIsMetadataCollapsed(!isMetadataCollapsed)}
                                        height={metadataPanelHeight}
                                        onHeightChange={setMetadataPanelHeight}
                                    />
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex justify-center items-center h-full w-full">
                            {isDragActive ? (
                                <p>Drop your file here ...</p>
                            ) : (
                                <p>
                                    {'Drag and drop your file here or '}
                                    <span className="border-b border-dotted border-black pb-1">Browse</span>
                                </p>
                            )}
                        </div>
                    )}
                </div>
                {selectedItem && <Sidebar selectedData={selectedItem.data} closeSidebar={closeSidebar} />}
            </div>
        </div>
    );
}
