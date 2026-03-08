import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    CalmArchitectureSchema,
    CalmNodeSchema,
    CalmRelationshipSchema,
} from '@finos/calm-models/types';
import { useDropzone } from 'react-dropzone';
import { ReactFlowVisualizer } from '../reactflow/ReactFlowVisualizer.js';
import { PatternVisualizer } from '../reactflow/PatternVisualizer.js';
import { Sidebar } from '../sidebar/Sidebar.js';
import { MetadataPanel } from '../reactflow/MetadataPanel.js';
import { toSidebarNodeData, toSidebarEdgeData } from '../reactflow/utils/patternClickHandlers.js';
import { THEME } from '../reactflow/theme.js';
import type { DrawerProps, SelectedItem, Flow, Control } from '../../contracts/contracts.js';

/**
 * Detect whether JSON data is a CALM pattern (JSON Schema) or an architecture instance.
 * Patterns have properties.nodes.prefixItems; architectures have nodes directly.
 */
function isPatternData(data: unknown): boolean {
    if (!data || typeof data !== 'object') return false;
    const obj = data as Record<string, unknown>;
    const props = obj['properties'] as Record<string, unknown> | undefined;
    return !!(props?.['nodes'] && typeof props['nodes'] === 'object' &&
        (props['nodes'] as Record<string, unknown>)['prefixItems']);
}

/**
 * Extract the unique-id from a CALM node or relationship
 */
function extractId(item: CalmNodeSchema | CalmRelationshipSchema): string {
    return item?.['unique-id'] || '';
}

export function Drawer({ data }: DrawerProps) {
    const [calmInstance, setCALMInstance] = useState<CalmArchitectureSchema | undefined>(undefined);
    const [patternInstance, setPatternInstance] = useState<Record<string, unknown> | undefined>(undefined);
    const [fileInstance, setFileInstance] = useState<Record<string, unknown> | undefined>(undefined);
    const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
    const [title, setTitle] = useState<string>('');
    // Default to collapsed as per user request
    const [isMetadataCollapsed, setIsMetadataCollapsed] = useState(true);
    // Height of the metadata panel when expanded (in pixels)
    const [metadataPanelHeight, setMetadataPanelHeight] = useState(250);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (acceptedFiles[0]) {
            const fileText = await acceptedFiles[0].text();
            const parsed = JSON.parse(fileText);
            setFileInstance(parsed);
            setTitle(acceptedFiles[0].name);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

    useEffect(() => {
        const source = fileInstance ?? data?.data;
        const isPattern = !!source && (
            isPatternData(source) || (!fileInstance && data?.calmType === 'Patterns')
        );

        setPatternInstance(isPattern ? (source as Record<string, unknown>) : undefined);
        setCALMInstance(isPattern ? undefined : (source as CalmArchitectureSchema | undefined));

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

    const hasContent = !!(calmInstance || patternInstance);

    const closeSidebar = useCallback(() => {
        setSelectedItem(null);
    }, []);

    // Pattern-specific click handlers
    const handlePatternNodeClick = useCallback((nodeData: Record<string, unknown>) => {
        setSelectedItem({ data: toSidebarNodeData(nodeData) });
    }, []);

    const handlePatternEdgeClick = useCallback((edgeData: Record<string, unknown>) => {
        setSelectedItem({ data: toSidebarEdgeData(edgeData) });
    }, []);

    const handleNodeClick = useCallback((nodeData: CalmNodeSchema) => {
        setSelectedItem({ data: toSidebarNodeData(nodeData as Record<string, unknown>) });
    }, []);

    const handleEdgeClick = useCallback((edgeData: CalmRelationshipSchema) => {
        setSelectedItem({ data: toSidebarEdgeData(edgeData as Record<string, unknown>) });
    }, []);

    // Handle transition click from flows panel - highlight the relationship
    const handleTransitionClick = useCallback((relationshipId: string) => {
        const relationship = calmInstance?.relationships?.find((r) => r['unique-id'] === relationshipId);
        if (relationship) {
            handleEdgeClick(relationship);
        }
    }, [calmInstance, handleEdgeClick]);

    // Handle node click from controls panel
    const handleControlNodeClick = useCallback((nodeId: string) => {
        const node = calmInstance?.nodes?.find((n) => n['unique-id'] === nodeId);
        if (node) {
            handleNodeClick(node);
        }
    }, [calmInstance, handleNodeClick]);

    return (
        <div {...getRootProps()} className="flex-1 flex overflow-hidden h-full">
            {!hasContent && <input {...getInputProps()} />}
            <div className={`drawer drawer-end ${selectedItem ? 'drawer-open' : ''} w-full h-full`}>
                <input
                    type="checkbox"
                    aria-label="drawer-toggle"
                    className="drawer-toggle"
                    checked={!!selectedItem}
                    onChange={closeSidebar}
                />
                <div className="drawer-content h-full flex flex-col">
                    {hasContent ? (
                        <>
                            {title && (
                                <div
                                    style={{
                                        padding: '8px 16px',
                                        borderBottom: `1px solid ${THEME.colors.border}`,
                                        backgroundColor: THEME.colors.backgroundSecondary,
                                        fontSize: '14px',
                                        fontWeight: 500,
                                        color: THEME.colors.foreground,
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
                                {patternInstance ? (
                                    <PatternVisualizer
                                        patternData={patternInstance}
                                        onNodeClick={handlePatternNodeClick}
                                        onEdgeClick={handlePatternEdgeClick}
                                        onBackgroundClick={closeSidebar}
                                    />
                                ) : calmInstance ? (
                                    <ReactFlowVisualizer
                                        calmData={calmInstance}
                                        onNodeClick={handleNodeClick}
                                        onEdgeClick={handleEdgeClick}
                                        onBackgroundClick={closeSidebar}
                                    />
                                ) : null}
                            </div>
                            {hasMetadata && !patternInstance && (
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
