import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalmArchitectureSchema, CalmNodeSchema, CalmRelationshipSchema } from '@finos/calm-models/types';
import { useDropzone } from 'react-dropzone';
import { ReactFlowVisualizer } from '../reactflow/ReactFlowVisualizer.js';
import { PatternVisualizer } from '../reactflow/PatternVisualizer.js';
import { MetadataPanel } from '../reactflow/MetadataPanel.js';
import { toSidebarNodeData, toSidebarEdgeData } from '../reactflow/utils/patternClickHandlers.js';
import { buildViewportKey } from '../../services/node-position-service.js';
import { DropzoneEmptyState } from './DropzoneEmptyState.js';
import { colors } from '../../../theme/colors.js';
import { DecoratorOverlayContext, isControlEvaluationView, type DecoratorOverlayState } from '../../context/DecoratorOverlayContext.js';
import { containersOfContainment, hasOverlay, matchesView, overlayByElement } from '../../overlay/overlayEngine.js';
import { useDecoratorViews } from '../../overlay/decoratorViews.js';
import { useOverlayVisibility } from '../../overlay/useOverlayVisibility.js';
import type { DrawerProps, Control, ControlEvaluationDecorator, Decorator, ViewOverlay } from '../../contracts/contracts.js';

const NO_DECORATORS: Decorator[] = [];

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
    viewportKeyOverride,
    defaultLayout,
    layoutEpoch,
    onPositionsChange,
    onDroppedFileChange,
    decorators = NO_DECORATORS,
    onOpenView,
    storage,
}: DrawerProps) {
    const [fileInstance, setFileInstance] = useState<Record<string, unknown> | undefined>(undefined);
    const [dropError, setDropError] = useState<string | undefined>(undefined);
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

    const source = fileInstance ?? data?.data;
    const isPattern = !!source && (isPatternData(source) || (!fileInstance && data?.calmType === 'Patterns'));
    const patternInstance = isPattern ? (source as Record<string, unknown>) : undefined;
    const calmInstance = isPattern ? undefined : (source as CalmArchitectureSchema | undefined);

    // Decorators and evaluations exist only for a loaded architecture, never for a dropped file.
    const architectureData = data && data.calmType === 'Architectures' && !fileInstance ? data : undefined;

    const showsDroppedFile = !!fileInstance;
    useEffect(() => {
        onDroppedFileChange?.(showsDroppedFile);
    }, [showsDroppedFile, onDroppedFileChange]);
    useEffect(() => () => onDroppedFileChange?.(false), [onDroppedFileChange]);

    const views = useDecoratorViews();
    const overlayDecorators = architectureData ? decorators : NO_DECORATORS;
    const overlays = useMemo((): ViewOverlay[] => {
        const drawnAs = containersOfContainment(calmInstance?.relationships);
        return views
            .filter(hasOverlay)
            .map((view) => ({ view, elements: overlayByElement(view, overlayDecorators, drawnAs) }))
            .filter(({ elements }) => elements.size > 0);
    }, [views, overlayDecorators, calmInstance]);
    const { hiddenViews, toggleView, setViewsShown } = useOverlayVisibility(views, storage);
    const overlayState = useMemo(
        (): DecoratorOverlayState => ({ overlays, hiddenViews, toggleView, setViewsShown, onOpenView }),
        [overlays, hiddenViews, toggleView, setViewsShown, onOpenView],
    );
    // The evaluation history for the panel under the diagram, which lists every evaluation, not only the newest.
    const evaluationView = useMemo(() => views.find(isControlEvaluationView), [views]);
    const evaluations = useMemo(
        () => (evaluationView ? overlayDecorators.filter((d) => matchesView(evaluationView, d)) as ControlEvaluationDecorator[] : []),
        [evaluationView, overlayDecorators],
    );

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

    const hasMetadata =
        Object.keys(controls).length > 0 || adrs.length > 0 || evaluations.length > 0;

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
                    <DecoratorOverlayContext.Provider value={overlayState}>
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
                    </DecoratorOverlayContext.Provider>
                    {hasMetadata && !patternInstance && (
                        <div
                            style={{
                                height: isMetadataCollapsed ? '48px' : `${metadataPanelHeight}px`,
                                flexShrink: 0,
                            }}
                        >
                            <MetadataPanel
                                controls={controls}
                                adrs={adrs}
                                evaluations={evaluations}
                                evaluationOverlay={evaluationView?.overlay}
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
