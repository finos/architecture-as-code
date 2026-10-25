import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
    Node,
    Background,
    Controls,
    ControlButton,
    MiniMap,
    Panel,
    useNodesState,
    useEdgesState,
    getBoundsOfRects,
    getNodesBounds,
    getViewportForBounds,
    type FitViewOptions,
    type ReactFlowInstance,
    type Viewport,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Gavel, Map as MapIcon, Presentation as PresentationIcon } from 'lucide-react';
import { MotionToggleButton } from './MotionToggleButton.js';
import { readViewportForKey, saveViewportForKey } from './utils/viewportStore.js';
import { FloatingEdge } from './FloatingEdge.js';
import { CustomNode } from './CustomNode.js';
import { SystemGroupNode } from './SystemGroupNode.js';
import { SearchBar } from './SearchBar.js';
import { presentParam, usePresentationMode } from '../../../theme/usePresentationMode.js';
import { DecisionOverlayContext, useCalloutSizes } from '../../context/DecisionOverlayContext.js';
import { subjectLabelsFor } from './utils/decisionSummary.js';
import { calloutRects } from './utils/labelPlacement.js';
import { THEME } from './theme.js';
import { colors } from '../../../theme/colors.js';
import { EmptyGraphState } from './EmptyGraphState.js';
import { parseCALMData } from './utils/calmTransformer.js';
import { getMatchingNodeIds, isEdgeVisible, getUniqueNodeTypes } from './utils/searchUtils.js';
import { useGraphInteractions } from './hooks/useGraphInteractions.js';
import { applyPositions, loadStoredNodePositions, toStoredPositions, type StoredNodePosition } from '../../services/node-position-service.js';
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
 * Contain-first fit: the whole graph must fit the pane. The floor drops to the
 * pane-level minZoom of 0.1, far below the desktop 0.6. The desktop value is a
 * legibility guard for a pane that owns the full window.
 *
 * Used on mobile, where the seeded TraderX architecture fits 390px only at about
 * 0.16, and by `fitToPane`, where sibling UI narrows the pane. At 0.6 the graph
 * cannot shrink more and overflows to the left and right. Tighter padding gives
 * back width. maxZoom matches desktop, so a sparse graph is not enlarged.
 */
const CONTAIN_FIT_VIEW_OPTIONS = { padding: 0.1, minZoom: 0.1, maxZoom: FIT_VIEW_OPTIONS.maxZoom } as const;

/** The pane's zoom range, which also bounds a fit that sets no range of its own. */
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 2;

/** Persist the minimap show/hide choice so it survives a refresh. */
const MINIMAP_HIDDEN_KEY = 'calmHub.diagramMinimapHidden';

function readMinimapHidden(): boolean {
    try {
        return sessionStorage.getItem(MINIMAP_HIDDEN_KEY) === '1';
    } catch {
        return false;
    }
}

/** Persist the decision overlay choice for the session. With no choice made, the overlay follows presentation mode. */
const DECISIONS_SHOWN_KEY = 'calmHub.diagramDecisionsShown';

/** Reading the `sessionStorage` global itself throws when site data is blocked. */
function defaultSessionStorage(): Storage | undefined {
    try {
        return sessionStorage;
    } catch {
        return undefined;
    }
}

function readDecisionsShown(storage: Storage | undefined): boolean | undefined {
    try {
        const value = storage?.getItem(DECISIONS_SHOWN_KEY);
        return value === '1' ? true : value === '0' ? false : undefined;
    } catch {
        return undefined;
    }
}

export function ArchitectureGraph({
    jsonData,
    onNodeClick,
    onEdgeClick,
    viewportKey,
    defaultLayout,
    layoutEpoch,
    onPositionsChange,
    fitToPane,
    presentationStore,
    storage = defaultSessionStorage(),
}: ArchitectureGraphProps) {
    const isMobile = useIsMobile();

    // The parse effect below calls onPositionsChange on every apply, not just
    // drag-end, so it must not itself re-run merely because the caller passed a
    // new function identity — that would re-parse and re-apply positions for no
    // data reason, and any future caller passing an inline arrow (rather than
    // DiagramSection's viewportKey-keyed useCallback) would loop forever: the
    // effect calls the callback, the callback triggers a parent render, the new
    // identity re-runs the effect. Hold the latest value in a ref, updated by a
    // post-commit effect (never during render — that would break under
    // StrictMode/concurrent rendering), and call through a stable wrapper so the
    // parse effect's dependency stays honest without an eslint-disable.
    const onPositionsChangeRef = useRef(onPositionsChange);
    useEffect(() => {
        onPositionsChangeRef.current = onPositionsChange;
    });
    const reportPositions = useCallback((positions: StoredNodePosition[]) => {
        onPositionsChangeRef.current?.(positions);
    }, []);

    // The viewport store key is namespaced by device. Mobile fits to a far lower zoom
    // floor (0.1 vs desktop's 0.6), so a viewport saved while mobile must not be
    // restored raw on desktop — defaultViewport bypasses fitViewOptions, so it would
    // silently defeat the desktop floor. Separate keys keep each device's view to itself.
    const storageKey = viewportKey ? `${isMobile ? 'mobile' : 'desktop'}:${viewportKey}` : undefined;

    // Restore the saved viewport for this diagram (so a refresh keeps the zoom/pan);
    // a different diagram has no saved viewport for its key, so it fits to view.
    const savedViewport = useMemo<Viewport | undefined>(
        () => (storageKey ? readViewportForKey(storageKey) : undefined),
        [storageKey]
    );

    const [nodes, setNodes, onNodesChangeBase] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const { searchTerm, setSearchTerm, typeFilter, setTypeFilter, availableNodeTypes, setAvailableNodeTypes, external: externalSearch } =
        useNodeSearch();

    // Ref holds the structural node data from parsing.
    // Filter effect reads from this instead of reactive state to avoid
    // re-triggering when setNodes/setEdges update styles.
    const sourceNodesRef = useRef<Node[]>([]);

    // Holds the React Flow instance so a viewport resize (rotation, browser-chrome
    // show/hide) or a desktop→mobile breakpoint crossing can re-fit the graph.
    // Captured via onInit on both devices so the ref exists even if the app started
    // on desktop and only later crossed into mobile.
    const flowInstanceRef = useRef<ReactFlowInstance | null>(null);

    // The pane element, watched by the optional refit-on-resize observer below.
    const containerRef = useRef<HTMLDivElement | null>(null);

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

    // `?present=1` in a link turns presentation mode on, and `?present=0` off. It is saved for the session, because a
    // switch between diagram tabs rewrites the query.
    const { presenting, setPresenting } = usePresentationMode(presentationStore);

    // The decision overlay draws each element's latest decision on the diagram. It follows presentation mode until it
    // is switched on its own, and switching presentation mode hands it back.
    const [decisionsShown, setDecisionsShownState] = useState<boolean | undefined>(() => readDecisionsShown(storage));
    const setDecisionsShown = useCallback((on: boolean | undefined) => {
        try {
            if (on === undefined) storage?.removeItem(DECISIONS_SHOWN_KEY);
            else storage?.setItem(DECISIONS_SHOWN_KEY, on ? '1' : '0');
        } catch {
            /* ignore unavailable storage */
        }
        setDecisionsShownState(on);
    }, [storage]);
    const showDecisions = decisionsShown ?? presenting;
    const switchPresentation = (on: boolean) => {
        setPresenting(on);
        setDecisionsShown(undefined);
    };
    // Set with the parsed graph, not derived from node state, which changes on every drag.
    const [subjectLabels, setSubjectLabels] = useState<Map<string, string>>(() => new Map());
    const { calloutSizes, reportCalloutSize, currentCalloutSizes } = useCalloutSizes();
    const decisionOverlay = useMemo(
        () => ({ showDecisions, subjectLabels, calloutSizes, reportCalloutSize }),
        [showDecisions, subjectLabels, calloutSizes, reportCalloutSize],
    );

    useLayoutEffect(() => {
        const param = presentParam();
        if (param === undefined) return;
        setPresenting(param);
        setDecisionsShown(undefined);
    }, [setPresenting, setDecisionsShown]);

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
    // restored one. Only a resource type useDefaultLayout supports (currently
    // architectures and patterns — see its SUPPORTED_TYPES — ever has
    // `viewportKey` set by DiagramSection while `defaultLayout` is still
    // `undefined`; dropped files resolve it to `null` immediately, and so does
    // any caller that never sets `viewportKey` in the first place.
    const awaitingDefaultLayout = !!viewportKey && defaultLayout === undefined;

    useEffect(() => {
        if (awaitingDefaultLayout) return;

        const { nodes: parsedNodes, edges: parsedEdges } = parseCALMData(jsonData, onNodeClick);
        sourceNodesRef.current = parsedNodes;

        // Precedence: a provided default layout (from document _layout or
        // server-saved) wins over stale localStorage scratch, so the document's
        // authoritative positions are always applied on page load. Scratch only
        // applies when there is no default — i.e. a fresh architecture with
        // neither a document _layout nor a server-saved layout.
        const localPositions = viewportKey ? loadStoredNodePositions(viewportKey) : null;
        const effectivePositions = localPositions ?? defaultLayout ?? null;
        const positionedNodes = applyPositions(parsedNodes, effectivePositions);

        setNodes(positionedNodes);
        setEdges(parsedEdges);
        setSubjectLabels(subjectLabelsFor(parsedNodes, parsedEdges));
        setAvailableNodeTypes(getUniqueNodeTypes(parsedNodes));
        reportPositions(toStoredPositions(positionedNodes));
        // layoutEpoch has no direct use in the body — it exists purely as a
        // dependency so "reset to default layout" (which bumps it) forces this
        // effect to re-run and cleanly re-apply positions. reportPositions is a
        // real dependency that happens to be identity-stable (see its definition
        // above), so a fresh onPositionsChange from the caller never re-runs this.
    }, [
        jsonData,
        setNodes,
        setEdges,
        setAvailableNodeTypes,
        onNodeClick,
        viewportKey,
        defaultLayout,
        layoutEpoch,
        awaitingDefaultLayout,
        reportPositions,
    ]);

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

    // fitView takes in React Flow's node bounds only. The decision callouts hang below the nodes, outside those bounds,
    // so while any are drawn a fit takes in their area too. False when there are none, as fitView alone is then right.
    const fitWithCallouts = useCallback((options: FitViewOptions = {}) => {
        const instance = flowInstanceRef.current;
        const container = containerRef.current;
        const callouts = currentCalloutSizes();
        if (!instance || !container || callouts.size === 0) return false;
        const shown = instance.getNodes().filter((node) => !node.hidden);
        const bounds = calloutRects(shown, callouts).reduce(getBoundsOfRects, getNodesBounds(shown));
        instance.setViewport(getViewportForBounds(
            bounds,
            container.clientWidth,
            container.clientHeight,
            options.minZoom ?? MIN_ZOOM,
            options.maxZoom ?? MAX_ZOOM,
            options.padding ?? 0.1,
        ));
        return true;
    }, [currentCalloutSizes]);
    const refit = useCallback((options: FitViewOptions) => {
        if (!fitWithCallouts(options)) flowInstanceRef.current?.fitView(options);
    }, [fitWithCallouts]);

    // One derived config, so the fit props stay in agreement. Mobile and an embedded
    // pane always fit on load and ignore a persisted viewport, because the user does
    // not size either one. Desktop restores its saved viewport, or fits if it has none.
    const flowConfig = fitToPane || isMobile
        ? { fitView: true, defaultViewport: undefined, fitViewOptions: CONTAIN_FIT_VIEW_OPTIONS }
        : { fitView: !savedViewport, defaultViewport: savedViewport, fitViewOptions: FIT_VIEW_OPTIONS };

    // React Flow's fit on load takes in the nodes only, and control evaluations can arrive after it. Fit the decision
    // callouts in when React Flow hands over its instance and as they come and go, until the viewer pans or zooms. A
    // restored viewport is left as it was. Like the fit button, a fit that takes in callouts may zoom out past the
    // desktop floor: on a small screen the callouts would otherwise stay cut off.
    const followsFit = useRef(flowConfig.fitView);
    useEffect(() => {
        followsFit.current = flowConfig.fitView;
    }, [viewportKey, flowConfig.fitView]);
    const { fitViewOptions } = flowConfig;
    const calloutFitOptions = useMemo(
        () => ({ ...fitViewOptions, minZoom: CONTAIN_FIT_VIEW_OPTIONS.minZoom }),
        [fitViewOptions],
    );
    useEffect(() => {
        if (followsFit.current && !fitWithCallouts(calloutFitOptions)) flowInstanceRef.current?.fitView(fitViewOptions);
    }, [calloutSizes, calloutFitOptions, fitViewOptions, fitWithCallouts]);

    // Mobile: re-fit the graph on a viewport resize (rotation, iOS chrome collapsing)
    // AND immediately when the app first crosses into mobile — fitView only auto-runs
    // on ReactFlow's initial mount, so a discrete breakpoint crossing (window snap,
    // foldable, DevTools toggle) without a later resize would otherwise leave the
    // graph un-fit (redesign problem #10). refit() is a no-op until onInit has run.
    useEffect(() => {
        if (!isMobile) return;
        const fit = () => refit(CONTAIN_FIT_VIEW_OPTIONS);
        fit();
        window.addEventListener('resize', fit);
        return () => window.removeEventListener('resize', fit);
    }, [isMobile, refit]);

    // fitView otherwise runs only at ReactFlow's initial mount. An embedded pane that
    // sibling UI resizes later then keeps a viewport scaled for its old size. Watch
    // the container, not window 'resize', to catch a change to the pane alone. The
    // callback is rAF-batched, because a synchronous fitView re-triggers the observer.
    useEffect(() => {
        const container = containerRef.current;
        if (!fitToPane || !container) return;

        let frame = 0;
        const observer = new ResizeObserver(() => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                refit(CONTAIN_FIT_VIEW_OPTIONS);
            });
        });
        observer.observe(container);
        return () => {
            cancelAnimationFrame(frame);
            observer.disconnect();
        };
    }, [fitToPane, nodes.length, refit]);

    if (awaitingDefaultLayout) {
        return <EmptyGraphState message="Loading saved layout…" />;
    }

    if (nodes.length === 0) {
        return <EmptyGraphState message="No architecture data to display. Load a CALM architecture to visualize." />;
    }

    return (
        <div ref={containerRef} style={{ height: '100%', width: '100%' }}>
            <DecisionOverlayContext.Provider value={decisionOverlay}>
                <ReactFlow
                    // Remount when the diagram (resource) changes so a new architecture fits
                    // afresh; switching versions/moments keeps the same key and preserves the
                    // view. layoutEpoch is deliberately NOT folded in here — it used to be, to
                    // force a remount on "reset to default layout", but savedViewport is only
                    // recomputed from storageKey (unchanged by an epoch bump), so a remount
                    // restored defaultViewport from whatever was read at mount time rather than
                    // the user's current pan/zoom: pan, zoom, drag a node, Save, and the canvas
                    // snapped back to the load-time view (worse on mobile, which re-fits
                    // unconditionally). The remount was never load-bearing for reset — the parse
                    // effect below already has layoutEpoch in its deps and re-applies positions
                    // on its own, which is all reset needs.
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
                    // React Flow passes the user's event, or null for a move of its own such as a fit.
                    onMoveStart={(event: MouseEvent | TouchEvent | null) => {
                        if (event) followsFit.current = false;
                    }}
                    onMove={(_, viewport) => {
                        if (storageKey) saveViewportForKey(storageKey, viewport);
                    }}
                    // Capture the instance on both devices so a later desktop→mobile
                    // crossing can re-fit (the effect above), then spread the device-derived
                    // fit config so the props always agree. React Flow has fitted the nodes by now, and callouts
                    // may already be drawn, so the fit takes them in.
                    onInit={(instance) => {
                        flowInstanceRef.current = instance;
                        if (followsFit.current) fitWithCallouts(calloutFitOptions);
                    }}
                    {...flowConfig}
                    minZoom={MIN_ZOOM}
                    maxZoom={MAX_ZOOM}
                    attributionPosition="bottom-left"
                    style={{ background: THEME.colors.background }}
                >
                    {/* The dot colour is set in index.css, not here: ReactFlow writes this
                        prop into an SVG `fill` presentation attribute, where `var()` does
                        not resolve. */}
                    <Background gap={16} />
                    {!isMobile && (
                        <Controls
                            // The button's own fit runs first, and this one replaces it while callouts are drawn.
                            onFitView={() => fitWithCallouts()}
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
                                    color={minimapHidden ? THEME.colors.muted : colors.redesign.primaryText}
                                />
                            </ControlButton>
                            <MotionToggleButton />
                            <ControlButton
                                onClick={() => switchPresentation(!presenting)}
                                title="Presentation mode"
                                aria-label="Presentation mode"
                                aria-pressed={presenting}
                            >
                                <PresentationIcon
                                    size={14}
                                    color={presenting ? colors.redesign.primaryText : THEME.colors.muted}
                                />
                            </ControlButton>
                            <ControlButton
                                onClick={() => setDecisionsShown(!showDecisions)}
                                title="Show decisions"
                                aria-label="Show decisions"
                                aria-pressed={showDecisions}
                            >
                                <Gavel
                                    size={14}
                                    color={showDecisions ? colors.redesign.primaryText : THEME.colors.muted}
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
                            fitViewOptions={CONTAIN_FIT_VIEW_OPTIONS}
                            onFitView={() => fitWithCallouts(CONTAIN_FIT_VIEW_OPTIONS)}
                        />
                    )}
                    {/* Presentation mode hides the minimap: on a projector it is clutter. */}
                    {!isMobile && !minimapHidden && !presenting && (
                        <MiniMap
                            data-testid="diagram-minimap"
                            className="calm-minimap-mask-surface"
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
                            // The ~25% mask that keeps the surrounding field faint is applied
                            // in index.css via `.calm-minimap-mask-surface`: `maskColor` lands
                            // in an SVG `fill` attribute, which `var()` cannot reach.
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
            </DecisionOverlayContext.Provider>
        </div>
    );
}
