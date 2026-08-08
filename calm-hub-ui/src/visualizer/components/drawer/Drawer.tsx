import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalmArchitectureSchema, CalmNodeSchema, CalmRelationshipSchema } from '@finos/calm-models/types';
import { useDropzone } from 'react-dropzone';
import { ReactFlowVisualizer } from '../reactflow/ReactFlowVisualizer.js';
import { PatternVisualizer } from '../reactflow/PatternVisualizer.js';
import { MetadataPanel } from '../reactflow/MetadataPanel.js';
import { toSidebarNodeData, toSidebarEdgeData } from '../reactflow/utils/patternClickHandlers.js';
import { CalmService } from '../../../service/calm-service.js';
import { DropzoneEmptyState } from './DropzoneEmptyState.js';
import { colors } from '../../../theme/colors.js';
import type { DrawerProps, Flow, Control, Decorator } from '../../contracts/contracts.js';

/**
 * Detect whether JSON data is a CALM pattern (JSON Schema) or an architecture instance.
 * A pattern declares its nodes as a JSON Schema array — either as positional
 * `prefixItems` slots or as an open `items` catalog (or both); an architecture has
 * `nodes` directly as a plain array of instances. A catalog-only pattern has no
 * `prefixItems`, so `items` must be accepted too, otherwise it would be misclassified
 * as an architecture on the file-upload path (the Hub path is saved separately by the
 * `calmType === 'Patterns'` fallback below).
 */
function isPatternData(data: unknown): boolean {
    if (!data || typeof data !== 'object') return false;
    const obj = data as Record<string, unknown>;
    const props = obj['properties'] as Record<string, unknown> | undefined;
    const nodes = props?.['nodes'] as Record<string, unknown> | undefined;
    return !!(nodes && typeof nodes === 'object' && (nodes['prefixItems'] || nodes['items']));
}

/**
 * Extract the unique-id from a CALM node or relationship
 */
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
    // Set when a dropped/browsed file can't be read as JSON, so the empty state
    // can surface the failure instead of throwing an unhandled rejection.
    const [dropError, setDropError] = useState<string | undefined>(undefined);
    const [decoratorsState, setDecoratorsState] = useState<Decorator[]>([]);
    // Default to collapsed as per user request
    const [isMetadataCollapsed, setIsMetadataCollapsed] = useState(true);
    // Height of the metadata panel when expanded (in pixels)
    const [metadataPanelHeight, setMetadataPanelHeight] = useState(250);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (!acceptedFiles[0]) return;
        try {
            const fileText = await acceptedFiles[0].text();
            const parsed = JSON.parse(fileText);
            setDropError(undefined);
            setFileInstance(parsed);
        } catch {
            // Non-JSON or malformed file: surface the failure rather than
            // accepting it and throwing an unhandled rejection downstream.
            setDropError(
                "Couldn't read that file — expected CALM JSON (architecture / pattern)."
            );
        }
    }, []);

    // Clear any prior error as soon as a new drag begins, so a fresh attempt
    // starts from a clean slate.
    const onDragEnter = useCallback(() => setDropError(undefined), []);

    // No `accept` filter: CALM JSON is often saved with a non-.json extension
    // (.calm, .txt, none), and an extension/MIME filter would reject those before
    // onDrop ever runs. onDrop parses the file and surfaces a clear dropError on
    // anything that isn't valid JSON, so validation lives there, not in the filter.
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        onDragEnter,
    });

    // Identifies the diagram (ignoring version) so its viewport can be remembered
    // across version/moment switches and refreshes. A dropped file has no identity,
    // so it must never resolve to `viewportKeyOverride` (DiagramSection's resolved
    // namespace/numeric-architectureId for the *currently loaded* architecture) —
    // otherwise dragging a node on a dropped file would write scratch positions,
    // and "Save as default layout" would write server positions, under the loaded
    // architecture's key using the dropped file's unrelated layout.
    // `viewportKeyOverride` takes precedence when present and no file is dropped,
    // so scratch storage and the server layout share one key regardless of whether
    // this architecture was reached via a slug or numeric route. An explicit `null`
    // override (a slug that finished resolving with no match) suppresses the
    // fallback rather than triggering it — falling back to the slug here would
    // reintroduce exactly the key split the override exists to close.
    const computedViewportKey = !fileInstance && data ? `${data.name}/${data.id}` : undefined;
    const viewportKey = fileInstance || viewportKeyOverride === null ? undefined : (viewportKeyOverride ?? computedViewportKey);

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

    // Extract flows from CALM data
    const flows = useMemo((): Flow[] => {
        const calmData = calmInstance as CalmArchitectureSchema & { flows?: Flow[] };
        return calmData?.flows || [];
    }, [calmInstance]);

    // Extract ADR links from CALM data
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

    // Extract controls from CALM data (from root, nodes, and relationships)
    const controls = useMemo((): Record<string, Control> => {
        const calmData = calmInstance as CalmArchitectureSchema & {
            controls?: Record<string, Control>;
        };
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

    const hasMetadata = flows.length > 0 || Object.keys(controls).length > 0 || decorators.length > 0 || adrs.length > 0;

    const hasContent = !!(calmInstance || patternInstance);

    const closeSidebar = useCallback(() => {
        onItemSelect?.(null);
    }, [onItemSelect]);

    // Pattern-specific click handlers
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

    // Handle transition click from flows panel - highlight the relationship
    const handleTransitionClick = useCallback(
        (relationshipId: string) => {
            const relationship = calmInstance?.relationships?.find((r) => r['unique-id'] === relationshipId);
            if (relationship) {
                handleEdgeClick(relationship);
            }
        },
        [calmInstance, handleEdgeClick]
    );

    // Handle node click from controls panel
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
                            />
                        ) : calmInstance ? (
                            <ReactFlowVisualizer
                                calmData={calmInstance}
                                onNodeClick={handleNodeClick}
                                onEdgeClick={handleEdgeClick}
                                onBackgroundClick={closeSidebar}
                                viewportKey={viewportKey}
                                defaultLayout={defaultLayout}
                                layoutEpoch={layoutEpoch}
                                // Never reported for a dropped file: `onPositionsChange`
                                // ultimately feeds DiagramSection's "Save as default
                                // layout", which is scoped to the *loaded architecture*
                                // (via `viewportKeyOverride`/`defaultLayoutState`, not
                                // this component's local `fileInstance` state). Passing
                                // it through unconditionally would let a locally-dropped
                                // file's on-screen positions be saved as the shared
                                // default layout for the architecture actually being
                                // viewed.
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
                                flows={flows}
                                controls={controls}
                                decorators={decorators}
                                adrs={adrs}
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
                <DropzoneEmptyState isDragActive={isDragActive} error={dropError} />
            )}
        </div>
    );
}
