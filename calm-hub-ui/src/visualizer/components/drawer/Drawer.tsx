import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalmArchitectureSchema, CalmNodeSchema, CalmRelationshipSchema } from '@finos/calm-models/types';
import { useDropzone } from 'react-dropzone';
import { ReactFlowVisualizer } from '../reactflow/ReactFlowVisualizer.js';
import { PatternVisualizer } from '../reactflow/PatternVisualizer.js';
import { MetadataPanel } from '../reactflow/MetadataPanel.js';
import { toSidebarNodeData, toSidebarEdgeData } from '../reactflow/utils/patternClickHandlers.js';
import { CalmService } from '../../../service/calm-service.js';
import { buildViewportKey } from '../../services/node-position-service.js';
import { DropzoneEmptyState } from './DropzoneEmptyState.js';
import { colors } from '../../../theme/colors.js';
import type { DrawerProps, Control, Decorator } from '../../contracts/contracts.js';

/**
 * A pattern declares its nodes under `properties.nodes`, as `prefixItems` or `items`.
 * An architecture carries `nodes` directly.
 */
function isPatternData(data: unknown): boolean {
    if (!data || typeof data !== 'object') return false;
    const obj = data as Record<string, unknown>;
    const props = obj['properties'] as Record<string, unknown> | undefined;
    const nodes = props?.['nodes'] as Record<string, unknown> | undefined;
    return !!(nodes && typeof nodes === 'object' && (nodes['prefixItems'] || nodes['items']));
}

function extractId(item: CalmNodeSchema | CalmRelationshipSchema): string {
    return item?.['unique-id'] || '';
}

export function Drawer({
    data,
    onItemSelect,
    decorators: decoratorsProp,
    viewportKeyOverride,
    defaultLayout,
    layoutEpoch,
    onPositionsChange,
}: DrawerProps) {
    const calmService = useMemo(() => new CalmService(), []);
    const [calmInstance, setCALMInstance] = useState<CalmArchitectureSchema | undefined>(undefined);
    const [patternInstance, setPatternInstance] = useState<Record<string, unknown> | undefined>(undefined);
    const [fileInstance, setFileInstance] = useState<Record<string, unknown> | undefined>(undefined);
    const [dropError, setDropError] = useState<string | undefined>(undefined);
    const [decoratorsState, setDecoratorsState] = useState<Decorator[]>([]);
    const [isMetadataCollapsed, setIsMetadataCollapsed] = useState(true);
    const [metadataPanelHeight, setMetadataPanelHeight] = useState(250);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (!acceptedFiles[0]) return;
        try {
            const fileText = await acceptedFiles[0].text();
            const parsed = JSON.parse(fileText);
            setDropError(undefined);
            setFileInstance(parsed);
        } catch {
            // Surfaced in the empty state rather than thrown, which would go unhandled.
            setDropError(
                "Couldn't read that file — expected CALM JSON (architecture / pattern)."
            );
        }
    }, []);

    const onDragEnter = useCallback(() => setDropError(undefined), []);

    // No `accept` filter on purpose: CALM JSON is often saved as .calm, .txt or with no
    // extension, and a filter would reject those silently before onDrop ran.
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        onDragEnter,
    });

    // Remembers pan and zoom for one diagram across version switches and refreshes.
    //
    // A dropped file has no identity, so it must never borrow the override: its positions
    // would then be saved under the loaded architecture's key.
    // A `null` override means a slug resolved to nothing, so it suppresses the fallback
    // rather than triggering it.
    // `calmType` is in the key because architecture and pattern ids come from separate
    // counters, so Architecture 7 and Pattern 7 would otherwise collide.
    const computedViewportKey = !fileInstance && data ? buildViewportKey(data.name, data.calmType, data.id) : undefined;
    const viewportKey = fileInstance || viewportKeyOverride === null ? undefined : (viewportKeyOverride ?? computedViewportKey);

    // Dropped alongside `viewportKey`, and for the same reason: these describe the loaded
    // resource's saved layout. Otherwise dropping an edited copy of an open file re-applies
    // the saved positions by node id instead of laying it out fresh. The graph's
    // `awaitingDefaultLayout` gate reads only these two props and cannot see `fileInstance`.
    const effectiveDefaultLayout = fileInstance ? undefined : defaultLayout;
    const effectiveLayoutEpoch = fileInstance ? undefined : layoutEpoch;

    useEffect(() => {
        const source = fileInstance ?? data?.data;
        const isPattern = !!source && (isPatternData(source) || (!fileInstance && data?.calmType === 'Patterns'));

        setPatternInstance(isPattern ? (source as Record<string, unknown>) : undefined);
        setCALMInstance(isPattern ? undefined : (source as CalmArchitectureSchema | undefined));
    }, [fileInstance, data]);

    useEffect(() => {
        if (decoratorsProp !== undefined) return; // controlled externally — skip fetch
        if (!data || data.calmType !== 'Architectures' || fileInstance) {
            setDecoratorsState([]);
            return;
        }
        let cancelled = false;

        calmService
            .fetchDeploymentDecoratorsForArchitecture(data.name, data.id, data.version)
            .then((values) => { if (!cancelled) setDecoratorsState(values); })
            .catch(() => { if (!cancelled) setDecoratorsState([]); });

        return () => { cancelled = true; };
    }, [data, fileInstance, decoratorsProp, calmService]);

    const decorators = decoratorsProp ?? decoratorsState;


    const adrs = useMemo((): string[] => {
        const calmData = calmInstance as CalmArchitectureSchema & { adrs?: unknown };
        const rawAdrs = calmData?.adrs;
        if (!Array.isArray(rawAdrs)) {
            return [];
        }
        return rawAdrs
            .filter((adr): adr is string => typeof adr === 'string')
            .map((adr) => adr.trim())
            .filter((adr) => adr.length > 0);
    }, [calmInstance]);

    const controls = useMemo((): Record<string, Control> => {
        const calmData = calmInstance as CalmArchitectureSchema & {
            controls?: Record<string, Control>;
        };
        if (!calmData) return {};

        const rootControls: Record<string, Control> = calmData.controls || {};
        const nodeControls: Record<string, Control> = {};
        const relationshipControls: Record<string, Control> = {};

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

        return { ...nodeControls, ...relationshipControls, ...rootControls };
    }, [calmInstance]);

    const hasMetadata = Object.keys(controls).length > 0 || decorators.length > 0 || adrs.length > 0;

    const hasContent = !!(calmInstance || patternInstance);

    const closeSidebar = useCallback(() => {
        onItemSelect?.(null);
    }, [onItemSelect]);

    const handlePatternNodeClick = useCallback((nodeData: Record<string, unknown>) => {
        onItemSelect?.({ data: toSidebarNodeData(nodeData) });
    }, [onItemSelect]);

    const handlePatternEdgeClick = useCallback((edgeData: Record<string, unknown>) => {
        onItemSelect?.({ data: toSidebarEdgeData(edgeData) });
    }, [onItemSelect]);

    const handleNodeClick = useCallback((nodeData: CalmNodeSchema) => {
        onItemSelect?.({ data: toSidebarNodeData(nodeData as Record<string, unknown>) });
    }, [onItemSelect]);

    const handleEdgeClick = useCallback((edgeData: CalmRelationshipSchema) => {
        onItemSelect?.({ data: toSidebarEdgeData(edgeData as Record<string, unknown>) });
    }, [onItemSelect]);


    const handleControlNodeClick = useCallback(
        (nodeId: string) => {
            const node = calmInstance?.nodes?.find((n) => n['unique-id'] === nodeId);
            if (node) {
                handleNodeClick(node);
            }
        },
        [calmInstance, handleNodeClick]
    );

    return (
        <div {...getRootProps()} className="flex-1 flex flex-col overflow-hidden h-full">
            {!hasContent && <input {...getInputProps()} />}
            {hasContent ? (
                <>
                    {/* A bad drop over already-loaded content still needs feedback: the
                        empty state (which normally shows dropError) isn't mounted here. */}
                    {dropError && (
                        <div
                            role="alert"
                            className="shrink-0 mx-3 mt-2 px-3 py-2 rounded-md text-[12px]"
                            style={{
                                color: colors.status.error,
                                border: `1px solid ${colors.status.error}`,
                                backgroundColor: colors.redesign.surface,
                            }}
                        >
                            {dropError}
                        </div>
                    )}
                    <div
                        style={{
                            flex: 1,
                            minHeight: 0,
                            ...(hasMetadata && !isMetadataCollapsed ? { height: `calc(100% - ${metadataPanelHeight}px)` } : {}),
                        }}
                    >
                        {patternInstance ? (
                            <PatternVisualizer
                                patternData={patternInstance}
                                onNodeClick={handlePatternNodeClick}
                                onEdgeClick={handlePatternEdgeClick}
                                onBackgroundClick={closeSidebar}
                                viewportKey={viewportKey}
                                defaultLayout={effectiveDefaultLayout}
                                layoutEpoch={effectiveLayoutEpoch}
                                onPositionsChange={fileInstance ? undefined : onPositionsChange}
                            />
                        ) : calmInstance ? (
                            <ReactFlowVisualizer
                                calmData={calmInstance}
                                onNodeClick={handleNodeClick}
                                onEdgeClick={handleEdgeClick}
                                onBackgroundClick={closeSidebar}
                                viewportKey={viewportKey}
                                defaultLayout={effectiveDefaultLayout}
                                layoutEpoch={effectiveLayoutEpoch}
                                // Withheld for a dropped file. This feeds DiagramSection's
                                // "Save as default layout", which is scoped to the loaded
                                // architecture, so passing it through would save a dropped
                                // file's positions as that architecture's shared default.
                                onPositionsChange={fileInstance ? undefined : onPositionsChange}
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
                                controls={controls}
                                decorators={decorators}
                                adrs={adrs}
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
                <DropzoneEmptyState isDragActive={isDragActive} error={dropError} />
            )}
        </div>
    );
}
