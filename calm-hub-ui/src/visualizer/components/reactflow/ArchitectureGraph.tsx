import { useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
    Node,
    Background,
    Controls,
    ControlButton,
    MiniMap,
    Panel,
    useNodesState,
    useEdgesState,
    type ReactFlowInstance,
    type Viewport,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Map as MapIcon } from 'lucide-react';
import { readViewportForKey, saveViewportForKey } from './utils/viewportStore.js';
import { FloatingEdge } from './FloatingEdge.js';
import { CustomNode } from './CustomNode.js';
import { SystemGroupNode } from './SystemGroupNode.js';
import { SearchBar } from './SearchBar.js';
import { THEME } from './theme.js';
import { colors } from '../../../theme/colors.js';
import { EmptyGraphState } from './EmptyGraphState.js';
import { parseCALMData } from './utils/calmTransformer.js';
import { getMatchingNodeIds, isEdgeVisible, getUniqueNodeTypes } from './utils/searchUtils.js';
import { useGraphInteractions } from './hooks/useGraphInteractions.js';
import { applyStoredPositions } from '../../services/node-position-service.js';
import { useIsMobile } from '../../../hooks/useMediaQuery.js';
import { useNodeSearch } from './node-search-context.js';
import type { ArchitectureGraphProps } from '../../contracts/contracts.js';

const edgeTypes = { custom: FloatingEdge };
const nodeTypes = { custom: CustomNode, group: SystemGroupNode };
const GROUP_NODE_TYPES = ['group'];

/**
 * fitView floors the zoom so a dense graph doesn't shrink nodes below the point
 * where their labels are legible (redesign problem #6); the user can still pinch
 * out past this via the pane-level minZoom. maxZoom caps fit-to-view so a sparse
 * graph doesn't render its few nodes oversized. padding leaves breathing room.
 * A dense graph can therefore load with some nodes off-screen; the default-on
 * minimap is the off-screen cue (pan/pinch reveal the rest), so keep it default
 * visible — a future change that hides it by default would silently regress #6.
 */
const FIT_VIEW_OPTIONS = { padding: 0.2, minZoom: 0.6, maxZoom: 1.2 } as const;

/**
 * Mobile fit-to-view (redesign problem #10): the whole graph must fit a ~390px
 * viewport on load, so the floor drops to the pane-level minZoom (0.1) — far below
 * the desktop 0.6. A wide/dense graph genuinely needs to zoom out this far to fit a
 * phone: the seeded TraderX architecture (14 nodes inside a wide boundary group)
 * fits 390px only at ~0.16, so any higher floor leaves it clipped left/right
 * (verified live). Pinch-to-zoom is the native way to then read small labels.
 * Tighter padding (0.1) reclaims width on the narrow screen; maxZoom matches
 * desktop so a sparse graph isn't blown up.
 */
const MOBILE_FIT_VIEW_OPTIONS = { padding: 0.1, minZoom: 0.1, maxZoom: 1.2 } as const;

/** Persist the minimap show/hide choice so it survives a refresh. */
const MINIMAP_HIDDEN_KEY = 'calmHub.diagramMinimapHidden';

function readMinimapHidden(): boolean {
    try {
        return sessionStorage.getItem(MINIMAP_HIDDEN_KEY) === '1';
    } catch {
        return false;
    }
}

export function ArchitectureGraph({ jsonData, onNodeClick, onEdgeClick, viewportKey }: ArchitectureGraphProps) {
    // Restore the saved viewport for this diagram (so a refresh keeps the zoom/pan);
    // a different diagram has no saved viewport for its key, so it fits to view.
    const savedViewport = useMemo<Viewport | undefined>(
        () => (viewportKey ? readViewportForKey(viewportKey) : undefined),
        [viewportKey]
    );

    const [nodes, setNodes, onNodesChangeBase] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const { searchTerm, setSearchTerm, typeFilter, setTypeFilter, availableNodeTypes, setAvailableNodeTypes, external: externalSearch } =
        useNodeSearch();

    // Ref holds the structural node data from parsing.
    // Filter effect reads from this instead of reactive state to avoid
    // re-triggering when setNodes/setEdges update styles.
    const sourceNodesRef = useRef<Node[]>([]);

    // Holds the React Flow instance on mobile so a viewport resize (rotation,
    // browser-chrome show/hide) can re-fit the graph. Captured via onInit only on
    // mobile; desktop never sets it, keeping its props behaviourally unchanged.
    const flowInstanceRef = useRef<ReactFlowInstance | null>(null);

    const isMobile = useIsMobile();

    // Minimap is a help on dense graphs but clutter on sparse ones, so let the
    // user hide it; the choice persists for the session. Desktop-only — mobile
    // hides the minimap entirely (Phase 5 owns the mobile diagram).
    const [minimapHidden, setMinimapHidden] = useState<boolean>(() => readMinimapHidden());

    const toggleMinimap = () => {
        setMinimapHidden((prev) => {
            const next = !prev;
            try {
                sessionStorage.setItem(MINIMAP_HIDDEN_KEY, next ? '1' : '0');
            } catch {
                /* ignore unavailable storage */
            }
            return next;
        });
    };

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
    });

    useEffect(() => {
        const { nodes: parsedNodes, edges: parsedEdges } = parseCALMData(jsonData, onNodeClick);
        sourceNodesRef.current = parsedNodes;
        // Restore any custom layout the user dragged for this diagram, falling
        // back to the parsed auto-layout when none is stored.
        setNodes(viewportKey ? applyStoredPositions(viewportKey, parsedNodes) : parsedNodes);
        setEdges(parsedEdges);
        setAvailableNodeTypes(getUniqueNodeTypes(parsedNodes));
    }, [jsonData, setNodes, setEdges, setAvailableNodeTypes, onNodeClick, viewportKey]);

    // Search & filter
    const isSearchActive = searchTerm !== '' || typeFilter !== '';

    useEffect(() => {
        if (!isSearchActive) {
            setNodes((nds) => nds.map((n) => ({ ...n, style: { ...n.style, opacity: undefined } })));
            setEdges((eds) => eds.map((e) => ({ ...e, style: { ...e.style, opacity: undefined } })));
            return;
        }
        const srcNodes = sourceNodesRef.current;
        const matchingIds = getMatchingNodeIds(srcNodes, searchTerm, typeFilter);
        setNodes((nds) =>
            nds.map((n) => ({
                ...n,
                style: { ...n.style, opacity: matchingIds.has(n.id) ? 1 : 0.15 },
            }))
        );
        setEdges((eds) =>
            eds.map((e) => ({
                ...e,
                style: { ...e.style, opacity: isEdgeVisible(e, matchingIds) ? 1 : 0.1 },
            }))
        );
    }, [searchTerm, typeFilter, isSearchActive, setNodes, setEdges]);

    // Mobile only: re-fit the graph when the viewport resizes (device rotation,
    // iOS chrome collapsing) so it keeps fitting 390px and never drifts off-screen
    // (redesign problem #10). The ref keeps this off exhaustive-deps and means the
    // effect has no desktop counterpart. fitView() is a no-op until onInit runs.
    useEffect(() => {
        if (!isMobile) return;
        const refit = () => flowInstanceRef.current?.fitView(MOBILE_FIT_VIEW_OPTIONS);
        window.addEventListener('resize', refit);
        return () => window.removeEventListener('resize', refit);
    }, [isMobile]);

    if (nodes.length === 0) {
        return <EmptyGraphState message="No architecture data to display. Load a CALM architecture to visualize." />;
    }

    return (
        <div style={{ height: '100%', width: '100%' }}>
            <ReactFlow
                // Remount when the diagram (resource) changes so a new architecture fits
                // afresh; switching versions/moments keeps the same key and preserves the view.
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
                // Mobile always fits on load (ignoring any persisted desktop-scale
                // viewport) so the whole graph fits 390px (redesign problem #10);
                // desktop keeps its restore-or-fit behaviour byte-for-byte.
                onInit={isMobile ? (instance) => { flowInstanceRef.current = instance; } : undefined}
                fitView={isMobile ? true : !savedViewport}
                defaultViewport={isMobile ? undefined : savedViewport}
                fitViewOptions={isMobile ? MOBILE_FIT_VIEW_OPTIONS : FIT_VIEW_OPTIONS}
                minZoom={0.1}
                attributionPosition="bottom-left"
                style={{ background: THEME.colors.background }}
            >
                <Background color={THEME.colors.border} gap={16} />
                {!isMobile && (
                    <Controls
                        style={{
                            background: THEME.colors.card,
                            border: `1px solid ${THEME.colors.border}`,
                            borderRadius: '8px',
                        }}
                    >
                        <ControlButton
                            onClick={toggleMinimap}
                            title={minimapHidden ? 'Show minimap' : 'Hide minimap'}
                            aria-label={minimapHidden ? 'Show minimap' : 'Hide minimap'}
                            aria-pressed={!minimapHidden}
                        >
                            <MapIcon
                                size={14}
                                color={minimapHidden ? THEME.colors.muted : colors.redesign.primary}
                            />
                        </ControlButton>
                    </Controls>
                )}
                {isMobile && (
                    // Mobile gets visible zoom controls (redesign problem #11) —
                    // larger touch cells, bottom-right per Frame F, no minimap
                    // toggle (mobile has no minimap) and no lock cell. Sized via the
                    // scoped `calm-mobile-controls` CSS class so the desktop Controls
                    // styling above is untouched.
                    <Controls
                        className="calm-mobile-controls"
                        position="bottom-right"
                        showInteractive={false}
                        // Match the on-load fit cap so the "fit" button doesn't
                        // over-zoom a sparse graph (reactflow's default maxZoom is 2).
                        fitViewOptions={MOBILE_FIT_VIEW_OPTIONS}
                    />
                )}
                {!isMobile && !minimapHidden && (
                    <MiniMap
                        data-testid="diagram-minimap"
                        pannable
                        zoomable
                        // Fixed compact panel so the minimap can't overflow the canvas
                        // or collide with the drawer/timeline (redesign problem #5). The
                        // bottom offset clears the timeline bar pinned below the canvas.
                        style={{
                            width: 132,
                            height: 84,
                            bottom: 16,
                            background: colors.redesign.surface,
                            border: `1px solid ${colors.redesign.borderStrong}`,
                            borderRadius: 8,
                            overflow: 'hidden',
                            boxShadow: '0 2px 6px rgba(16,24,40,.06)',
                        }}
                        // Faint tinted node chips so the map reads as a soft field,
                        // not solid accent on every node.
                        nodeColor={`${colors.redesign.primary}40`}
                        nodeStrokeColor={`${colors.redesign.primary}66`}
                        // Light mask (~25%) so the surrounding field stays faint and the
                        // transparent viewport hole reads clearly; the primary-blue stroke
                        // outlines the current viewport rect.
                        maskColor={`${colors.redesign.surface}40`}
                        maskStrokeColor={colors.redesign.primary}
                        maskStrokeWidth={1.5}
                    />
                )}
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
