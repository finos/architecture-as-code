import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
    Node,
    Edge,
    Background,
    Controls,
    MiniMap,
    Panel,
    useNodesState,
    useEdgesState,
    type Viewport,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { readViewportForKey, saveViewportForKey } from './utils/viewportStore.js';
import { FloatingEdge } from './FloatingEdge.js';
import { CustomNode } from './CustomNode.js';
import { SystemGroupNode } from './SystemGroupNode.js';
import { DecisionGroupNode } from './DecisionGroupNode.js';
import { SearchBar } from './SearchBar.js';
import { THEME } from './theme.js';
import { EmptyGraphState } from './EmptyGraphState.js';
import { parsePatternData } from './utils/patternTransformer.js';
import { getMatchingNodeIds, isEdgeVisible, getUniqueNodeTypes } from './utils/searchUtils.js';
import { useGraphInteractions } from './hooks/useGraphInteractions.js';
import { applyPositions, loadStoredNodePositions, toStoredPositions, type StoredNodePosition } from '../../services/node-position-service.js';
import { useIsMobile } from '../../../hooks/useMediaQuery.js';
import { useNodeSearch } from './node-search-context.js';
import { DecisionSelectorPanel } from './DecisionSelectorPanel.js';
import {
    extractDecisionPoints,
    DecisionSelections,
    isDecisionFilterActive,
    getVisibleNodeIds,
    getVisibleEdgeIds,
} from './utils/decisionUtils.js';

const edgeTypes = { custom: FloatingEdge };
const nodeTypes = {
    custom: CustomNode,
    group: SystemGroupNode,
    decisionGroup: DecisionGroupNode,
};
const GROUP_NODE_TYPES = ['group', 'decisionGroup'];

interface PatternGraphProps {
    patternData: Record<string, unknown>;
    onNodeClick?: (nodeData: Record<string, unknown>) => void;
    onEdgeClick?: (edgeData: Record<string, unknown>) => void;
    viewportKey?: string;
    /** Server-stored default layout for a pattern. undefined = loading, null = none stored. */
    defaultLayout?: StoredNodePosition[] | null;
    /** Bumped to force a clean re-apply of positions (used by "reset to default"). */
    layoutEpoch?: number;
    onPositionsChange?: (positions: StoredNodePosition[]) => void;
}

export function PatternGraph({
    patternData,
    onNodeClick,
    onEdgeClick,
    viewportKey,
    defaultLayout,
    layoutEpoch,
    onPositionsChange,
}: PatternGraphProps) {
    const savedViewport = useMemo<Viewport | undefined>(
        () => (viewportKey ? readViewportForKey(viewportKey) : undefined),
        [viewportKey]
    );

    // See ArchitectureGraph: holds the latest onPositionsChange in a ref so the
    // parse effect below doesn't have to depend on the caller's function identity.
    const onPositionsChangeRef = useRef(onPositionsChange);
    useEffect(() => {
        onPositionsChangeRef.current = onPositionsChange;
    });
    const reportPositions = useCallback((positions: StoredNodePosition[]) => {
        onPositionsChangeRef.current?.(positions);
    }, []);

    const [nodes, setNodes, onNodesChangeBase] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const { searchTerm, setSearchTerm, typeFilter, setTypeFilter, availableNodeTypes, setAvailableNodeTypes, external: externalSearch } =
        useNodeSearch();
    const [decisionSelections, setDecisionSelections] = useState<DecisionSelections>(new Map());

    // Refs hold the structural node/edge data from parsing.
    // Filter effects read from these instead of reactive state to avoid
    // re-triggering when setNodes/setEdges update styles.
    const sourceNodesRef = useRef<Node[]>([]);
    const sourceEdgesRef = useRef<Edge[]>([]);

    const [decisionPoints, setDecisionPoints] = useState<ReturnType<typeof extractDecisionPoints>>([]);
    const isMobile = useIsMobile();

    const {
        onNodesChange,
        handleNodeClick,
        handleEdgeClick,
        handleNodeMouseEnter,
        handleNodeMouseLeave,
    } = useGraphInteractions({
        setNodes,
        onNodesChangeBase,
        onNodeClick,
        onEdgeClick,
        groupNodeTypes: GROUP_NODE_TYPES,
        persistKey: viewportKey,
        onPositionsChange: reportPositions,
    });

    // Still fetching the server default for this diagram: hold off applying
    // positions rather than flashing the auto-layout and then jumping to the
    // restored one. See ArchitectureGraph's awaitingDefaultLayout for the
    // invariant this relies on: DiagramSection is the only caller that ever
    // sets `viewportKey` here, and it always does so via useDefaultLayout,
    // which settles `defaultLayout` away from `undefined` for every type it
    // supports — so this can't get stuck for a caller that forgot to pass one.
    const awaitingDefaultLayout = !!viewportKey && defaultLayout === undefined;

    useEffect(() => {
        if (awaitingDefaultLayout) return;

        const { nodes: parsedNodes, edges: parsedEdges } = parsePatternData(patternData);
        sourceNodesRef.current = parsedNodes;
        sourceEdgesRef.current = parsedEdges;
        // Precedence: an unsaved local drag always wins over the saved default,
        // which in turn wins over the parsed auto-layout when neither is present.
        const localPositions = viewportKey ? loadStoredNodePositions(viewportKey) : null;
        const effectivePositions = localPositions ?? defaultLayout ?? null;
        const positionedNodes = applyPositions(parsedNodes, effectivePositions);

        setNodes(positionedNodes);
        setEdges(parsedEdges);
        setAvailableNodeTypes(getUniqueNodeTypes(parsedNodes));
        setDecisionPoints(extractDecisionPoints(parsedNodes));
        reportPositions(toStoredPositions(positionedNodes));
    }, [
        patternData,
        setNodes,
        setEdges,
        setAvailableNodeTypes,
        viewportKey,
        defaultLayout,
        layoutEpoch,
        awaitingDefaultLayout,
        reportPositions,
    ]);

    // Search & filter
    const isSearchActive = searchTerm !== '' || typeFilter !== '';
    const isDecisionActive = isDecisionFilterActive(decisionSelections);

    useEffect(() => {
        if (!isSearchActive && !isDecisionActive) {
            setNodes((nds) => nds.map((n) => ({ ...n, style: { ...n.style, opacity: undefined } })));
            setEdges((eds) => eds.map((e) => ({ ...e, style: { ...e.style, opacity: undefined } })));
            return;
        }

        const srcNodes = sourceNodesRef.current;
        const srcEdges = sourceEdgesRef.current;

        const searchVisibleNodeIds = isSearchActive ? getMatchingNodeIds(srcNodes, searchTerm, typeFilter) : null;
        const decisionVisibleNodeIds = getVisibleNodeIds(srcNodes, decisionPoints, decisionSelections);

        // Intersect: a node is visible if it passes both filters (null = no constraint)
        const finalVisibleNodeIds = new Set<string>();
        for (const node of srcNodes) {
            const inSearch = searchVisibleNodeIds === null || searchVisibleNodeIds.has(node.id);
            const inDecision = decisionVisibleNodeIds === null || decisionVisibleNodeIds.has(node.id);
            if (inSearch && inDecision) {
                finalVisibleNodeIds.add(node.id);
            }
        }

        setNodes((nds) =>
            nds.map((n) => ({
                ...n,
                style: { ...n.style, opacity: finalVisibleNodeIds.has(n.id) ? 1 : 0.15 },
            }))
        );

        const decisionVisibleEdgeIds = isDecisionActive && decisionVisibleNodeIds
            ? getVisibleEdgeIds(srcEdges, decisionVisibleNodeIds, decisionPoints, decisionSelections)
            : null;

        setEdges((eds) =>
            eds.map((e) => {
                const searchVisible = searchVisibleNodeIds === null || isEdgeVisible(e, searchVisibleNodeIds);
                const decisionVisible = decisionVisibleEdgeIds === null || decisionVisibleEdgeIds.has(e.id);
                return {
                    ...e,
                    style: { ...e.style, opacity: searchVisible && decisionVisible ? 1 : 0.1 },
                };
            })
        );
    }, [searchTerm, typeFilter, isSearchActive, isDecisionActive, decisionSelections, decisionPoints, setNodes, setEdges]);

    const handleDecisionSelectionChange = useCallback(
        (groupId: string, selectedIndices: number[]) => {
            setDecisionSelections((prev) => {
                const next = new Map(prev);
                if (selectedIndices.length === 0) {
                    next.delete(groupId);
                } else {
                    next.set(groupId, selectedIndices);
                }
                return next;
            });
        },
        []
    );

    const handleDecisionReset = useCallback(() => {
        setDecisionSelections(new Map());
    }, []);

    if (awaitingDefaultLayout) {
        return <EmptyGraphState message="Loading saved layout…" />;
    }

    if (nodes.length === 0) {
        return <EmptyGraphState message="No pattern data to display. Load a CALM pattern to visualize." />;
    }

    return (
        <div style={{ height: '100%', width: '100%' }}>
            <ReactFlow
                key={viewportKey}
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={handleNodeClick}
                onNodeMouseEnter={handleNodeMouseEnter}
                onNodeMouseLeave={handleNodeMouseLeave}
                onEdgeClick={handleEdgeClick}
                onMove={(_, viewport) => {
                    if (viewportKey) saveViewportForKey(viewportKey, viewport);
                }}
                fitView={!savedViewport}
                defaultViewport={savedViewport}
                fitViewOptions={{ padding: 0.2 }}
                attributionPosition="bottom-left"
                style={{ background: THEME.colors.background }}
            >
                {/* Dot colour lives in index.css — see ArchitectureGraph. */}
                <Background gap={16} />
                {!isMobile && (
                    <Controls
                        style={{
                            background: THEME.colors.card,
                            border: `1px solid ${THEME.colors.border}`,
                            borderRadius: '8px',
                        }}
                    />
                )}
                {!isMobile && (
                    <MiniMap
                        className="calm-minimap-mask-base"
                        style={{
                            background: THEME.colors.backgroundSecondary,
                            border: `1px solid ${THEME.colors.border}`,
                        }}
                        nodeColor={THEME.colors.accent}
                    />
                )}
                <Panel position="top-left">
                    <DecisionSelectorPanel
                        decisionPoints={decisionPoints}
                        selections={decisionSelections}
                        onSelectionChange={handleDecisionSelectionChange}
                        onReset={handleDecisionReset}
                    />
                </Panel>
                {!externalSearch && (
                <Panel position="top-right">
                    <SearchBar
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                        typeFilter={typeFilter}
                        onTypeFilterChange={setTypeFilter}
                        nodeTypes={availableNodeTypes}
                    />
                </Panel>
                )}
            </ReactFlow>
        </div>
    );
}
