import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useMatch, useNavigate } from 'react-router-dom';
import { IoChevronForwardOutline, IoCompassOutline } from 'react-icons/io5';
import { ExploreRail } from './components/explore-rail/ExploreRail.js';
import { MobileNavMenu } from './components/tree-navigation/MobileNavMenu.js';
import { NamespacePage } from './components/namespace-page/NamespacePage.js';
import { DomainPage } from './components/domain-page/DomainPage.js';
import { FirstRunLanding } from './components/first-run-landing/FirstRunLanding.js';
import { useResourceFromRoute } from './hooks/useResourceFromRoute.js';
import { useIsMobile } from '../hooks/useMediaQuery.js';
import { BreadcrumbItem, Data, Adr } from '../model/calm.js';
import { ControlData } from '../model/control.js';
import { InterfaceData } from '../model/interface.js';
import { NamespaceCounts, DomainControlCount } from '../model/counts.js';
import { CountsService } from '../service/counts-service.js';
import { Navbar } from '../components/navbar/Navbar.js';
import { AdrRenderer } from './components/adr-renderer/AdrRenderer.js';
import { DocumentDetailSection } from './components/document-detail-section/DocumentDetailSection.js';
import { ControlPanel } from './components/control-detail-section/ControlPanel.js';
import { InterfaceDetailSection } from './components/interface-detail-section/InterfaceDetailSection.js';
import { DiagramSection } from './components/diagram-section/DiagramSection.js';
import { Sidebar } from '../visualizer/components/sidebar/Sidebar.js';
import { NodeSheet } from '../visualizer/components/sidebar/NodeSheet.js';
import { DiagramActionsContext } from '../visualizer/context/DiagramActionsContext.js';
import { ResourceNotFound } from './components/resource-not-found/ResourceNotFound.js';
import { parseCALMHubPath } from '../visualizer/components/reactflow/utils/calmHelpers.js';
import type { SelectedItem } from '../visualizer/contracts/contracts.js';
import type { CalmNodeSchema } from '@finos/calm-models/types';
import { authStore } from '../service/utils/auth-store.js';
import './Hub.css';

// Breadcrumbs live in history state so Back restores the parent's trail for free,
// at the documented cost that a hard refresh or shared deep link starts with an
// empty trail. History state is untyped and can be stale (older sessions) or set
// by other code, so validate the shape instead of trusting a cast.
function readBreadcrumbs(state: unknown): BreadcrumbItem[] {
    const crumbs = (state as { breadcrumbs?: unknown } | null)?.breadcrumbs;
    if (!Array.isArray(crumbs)) return [];
    return crumbs.filter(
        (c): c is BreadcrumbItem =>
            typeof c === 'object' &&
            c !== null &&
            typeof (c as BreadcrumbItem).namespace === 'string' &&
            ((c as BreadcrumbItem).type === 'architectures' || (c as BreadcrumbItem).type === 'patterns') &&
            typeof (c as BreadcrumbItem).id === 'string' &&
            typeof (c as BreadcrumbItem).version === 'string'
    );
}

export default function Hub() {
    const navigate = useNavigate();
    const location = useLocation();
    const currentDisplayNameRef = useRef<string | undefined>(undefined);
    const [data, setData] = useState<Data | undefined>();
    const [adrData, setAdrData] = useState<Adr | undefined>();
    const [controlData, setControlData] = useState<ControlData | undefined>();
    const [interfaceData, setInterfaceData] = useState<InterfaceData | undefined>();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(true);
    const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
    // A detail-route load rejected (missing resource, dangling reference). Cleared
    // on every navigation; renders ResourceNotFound instead of an empty pane.
    const [resourceLoadFailed, setResourceLoadFailed] = useState(false);
    const [namespaceCounts, setNamespaceCounts] = useState<NamespaceCounts[]>([]);
    const [namespaceCountsLoaded, setNamespaceCountsLoaded] = useState(false);
    // Distinct from "loaded": a failed counts fetch means counts are unknown, not
    // zero, so consumers must render them as unknown rather than a misleading 0.
    const [namespaceCountsFailed, setNamespaceCountsFailed] = useState(false);
    const [domainCounts, setDomainCounts] = useState<DomainControlCount[]>([]);
    const [domainCountsLoaded, setDomainCountsLoaded] = useState(false);
    const isMobile = useIsMobile();

    // Route-first content selection (redesign problem #4): the same <Hub/> element
    // is reused across `/`, `/namespace/:ns`, `/domain/:domain` and the detail
    // route, so the URL — not residual state — decides what renders.
    const namespaceMatch = useMatch('/namespace/:ns');
    const domainMatch = useMatch('/domain/:domain');
    const detailMatch = useMatch('/:namespace/:type/:id/:version');
    const activeNamespace = namespaceMatch?.params.ns;
    const activeDomain = domainMatch?.params.domain;
    const isDetailRoute = detailMatch !== null;

    const countsService = useMemo(() => new CountsService(), []);

    // Runs once: countsService is memoised and Hub is the top-level page, so this effect
    // never re-fires and there is no in-flight fetch to cancel on a dependency change. (Unlike
    // useNamespaceItems, whose fetch effect re-runs per namespace and so needs a cancel guard.)
    useEffect(() => {
        countsService
            .fetchNamespaceCounts()
            .then(setNamespaceCounts)
            // On failure counts are unknown, not zero: flag it so the tabs render
            // resting (no badge) rather than a misleading dimmed 0 while the
            // independent item grid still fills below.
            .catch(() => {
                setNamespaceCounts([]);
                setNamespaceCountsFailed(true);
            })
            // Mark loaded on success or failure so consumers can tell "counts
            // unknown (loading)" from "known zero" — an absent namespace after a
            // successful fetch is genuinely zero, not still loading.
            .finally(() => setNamespaceCountsLoaded(true));
        countsService
            .fetchDomainCounts()
            .then(setDomainCounts)
            .catch(() => setDomainCounts([]))
            .finally(() => setDomainCountsLoaded(true));
    }, [countsService]);

    useEffect(() => {
        return authStore.subscribe((status) => {
            if (status === 401 || status === 403) {
                setData(undefined);
                setAdrData(undefined);
                setControlData(undefined);
                setInterfaceData(undefined);
                setSelectedItem(null);
            }
        });
    }, []);

    // Every navigation clears any loaded resource so the incoming route decides what
    // renders — including navigating *to* a detail route, where a stale in-place control
    // would otherwise flash before the new fetch resolves (detailContent evaluates
    // controlData first). Keyed on react-router's location.key, which changes on every
    // navigation but NOT on an in-place control/interface load (that sets state without
    // navigating), so those loads are preserved. Runs in a layout effect so the clear
    // happens before paint, avoiding a one-frame flash of the stale panel.
    useLayoutEffect(() => {
        setData(undefined);
        setAdrData(undefined);
        setControlData(undefined);
        setInterfaceData(undefined);
        setSelectedItem(null);
        setResourceLoadFailed(false);
    }, [location.key]);

    const handleDataLoad = useCallback((loaded: Data) => {
        setData(loaded);
        setAdrData(undefined);
        setControlData(undefined);
        setInterfaceData(undefined);
        setSelectedItem(null);
        setIsMobileNavOpen(false);
        currentDisplayNameRef.current = undefined;
    }, []);

    const handleAdrLoad = useCallback((adr: Adr) => {
        setAdrData(adr);
        setData(undefined);
        setControlData(undefined);
        setInterfaceData(undefined);
        setSelectedItem(null);
        setIsMobileNavOpen(false);
    }, []);

    const handleControlLoad = useCallback((control: ControlData) => {
        setControlData(control);
        setData(undefined);
        setAdrData(undefined);
        setInterfaceData(undefined);
        setSelectedItem(null);
        setIsMobileNavOpen(false);
    }, []);

    const handleInterfaceLoad = useCallback((iface: InterfaceData) => {
        setInterfaceData(iface);
        setData(undefined);
        setAdrData(undefined);
        setControlData(undefined);
        setSelectedItem(null);
        setIsMobileNavOpen(false);
    }, []);

    const handleResourceLoadError = useCallback((error: unknown) => {
        console.error('%s', 'Failed to load routed resource:', error);
        setResourceLoadFailed(true);
    }, []);

    // Single owner of deep-link / external-navigation loading for the detail route.
    useResourceFromRoute({
        onDataLoad: handleDataLoad,
        onAdrLoad: handleAdrLoad,
        onControlLoad: handleControlLoad,
        onInterfaceLoad: handleInterfaceLoad,
        onLoadError: handleResourceLoadError,
    });

    const handleItemSelect = useCallback((item: SelectedItem) => {
        setSelectedItem(item);
    }, []);

    const closeSidebar = useCallback(() => {
        setSelectedItem(null);
    }, []);

    // Closes the control detail panel. On the detail route (a control reached via a
    // deep-link or the mobile drill-down, which navigates to /:domain/controls/:id/
    // detail) navigate to the domain grid so closing lands on the cards, not a blank
    // detail route. For an in-place selection on /domain/:domain the grid is already
    // the backdrop, so just clear the control.
    const handleControlClose = useCallback(() => {
        if (isDetailRoute && controlData) {
            navigate(`/domain/${encodeURIComponent(controlData.domain)}`);
        } else {
            setControlData(undefined);
        }
    }, [isDetailRoute, controlData, navigate]);

    // Activating a card from the backdrop grid. On the detail route the URL owns the
    // selected control, so navigate to the new control's detail route (which reloads
    // it via useResourceFromRoute) rather than swapping it in place — otherwise the
    // URL and panel desync and Back/refresh reverts to the deep-linked control. Off
    // the detail route (/domain/:domain) load in place as before. For controls the
    // domain segment is the namespace (see useResourceFromRoute), so the route is
    // /<domain>/controls/<id>/detail.
    const handleControlActivate = useCallback(
        (control: ControlData) => {
            if (isDetailRoute) {
                navigate(`/${encodeURIComponent(control.domain)}/controls/${control.controlId}/detail`);
            } else {
                handleControlLoad(control);
            }
        },
        [isDetailRoute, navigate, handleControlLoad]
    );

    // The resource's display name is fetched by DiagramSection (it owns the
    // summaries fetch) and mirrored here so the crumb pushed on navigation can
    // carry it. A ref, not state: it is only read imperatively at navigate time,
    // so Hub need not re-render when it resolves. This handler MUST stay memoised
    // (identity-stable) — DiagramSection lists it in a fetch effect's deps.
    const handleDisplayNameChange = useCallback((name: string | undefined) => {
        currentDisplayNameRef.current = name;
    }, []);

    const handleNavigateToDetailedArch = useCallback((ref: string) => {
        const parsed = parseCALMHubPath(ref);
        if (!parsed || !data) return;
        const currentCrumb: BreadcrumbItem = {
            namespace: data.name,
            type: data.calmType === 'Architectures' ? 'architectures' : 'patterns',
            id: data.id,
            version: data.version,
            name: currentDisplayNameRef.current,
        };
        navigate(`/${parsed.namespace}/${parsed.type}/${parsed.id}/${parsed.version}`, {
            state: { breadcrumbs: [...readBreadcrumbs(location.state), currentCrumb] }
        });
    }, [navigate, data, location.state]);

    const breadcrumbs = useMemo(() => readBreadcrumbs(location.state), [location.state]);

    // Single, memoised provider value for every detailed-architecture navigation
    // consumer: CustomNode (which ReactFlow instantiates internally, out of reach
    // of props) and NodeDetails (rendered in both the Sidebar and the NodeSheet).
    // Memoised so consumers don't re-render on unrelated Hub renders.
    const diagramActions = useMemo(
        () => ({ onNavigateToDetailedArch: handleNavigateToDetailedArch }),
        [handleNavigateToDetailedArch]
    );

    const isDiagramView = data?.calmType === 'Architectures' || data?.calmType === 'Patterns';

    // Mobile node bottom-sheet prev/next steppers (Frame G). The ordered node list
    // is already in Hub — it's exactly what the Drawer renders (`data.data.nodes`)
    // — so steppers need no new prop threading and never touch the desktop drawer.
    // Architecture-only (its `nodes` is a flat array; patterns nest them under
    // `properties.nodes` and degrade to no steppers) and node-only (a selected edge
    // has no place in the node list, so the neighbours resolve to undefined).
    // Steppers only feed the mobile NodeSheet; desktop renders <Sidebar> and never
    // consumes onPrev/onNext, so skip the derivation entirely off mobile.
    const diagramNodes = useMemo<CalmNodeSchema[]>(() => {
        if (!isMobile) return [];
        const nodes = (data?.data as { nodes?: unknown } | undefined)?.nodes;
        return Array.isArray(nodes) ? (nodes as CalmNodeSchema[]) : [];
    }, [data, isMobile]);

    const selectedNodeIndex = useMemo(() => {
        const selected = selectedItem?.data;
        if (!selected || !('node-type' in selected)) return -1;
        const id = selected['unique-id'];
        return diagramNodes.findIndex((n) => n['unique-id'] === id);
    }, [selectedItem, diagramNodes]);

    // Plain function, not useCallback: onPrev/onNext below are fresh inline closures
    // each render regardless, so memoising this buys no referential stability.
    const stepToNode = (index: number) => {
        const node = diagramNodes[index];
        if (node) setSelectedItem({ data: node });
    };

    const onPrevNode = selectedNodeIndex > 0 ? () => stepToNode(selectedNodeIndex - 1) : undefined;
    const onNextNode =
        selectedNodeIndex >= 0 && selectedNodeIndex < diagramNodes.length - 1 ? () => stepToNode(selectedNodeIndex + 1) : undefined;

    // The active namespace's full per-type counts, passed straight to NamespacePage
    // so its type tabs show counts without a second fetch. `undefined` while the
    // counts fetch is in flight OR if it failed — distinct from a known all-zero
    // record — so the page renders tabs resting (not dimmed 0) rather than
    // contradicting the item grid, and defers the first-non-empty default until
    // counts resolve. Once loaded successfully, a namespace absent from the list is
    // a genuine all-zero (e.g. an unknown namespace), not still loading.
    const activeNamespaceCounts = useMemo<NamespaceCounts | undefined>(() => {
        if (!namespaceCountsLoaded || namespaceCountsFailed) return undefined;
        return (
            namespaceCounts.find((c) => c.namespace === activeNamespace) ?? {
                namespace: activeNamespace ?? '',
                architectures: 0,
                patterns: 0,
                flows: 0,
                standards: 0,
                adrs: 0,
                interfaces: 0,
                total: 0,
            }
        );
    }, [namespaceCounts, namespaceCountsLoaded, namespaceCountsFailed, activeNamespace]);
    // Both counts stay `undefined` until the domain-counts fetch settles, so a
    // deep-link shows "controls" rather than a misleading "0 controls" before it
    // resolves (mirrors the activeNamespaceCounts gate above).
    const domainControlCount = useMemo(
        () => (domainCountsLoaded ? (domainCounts.find((c) => c.domain === activeDomain)?.controlCount ?? 0) : undefined),
        [domainCounts, domainCountsLoaded, activeDomain]
    );
    // Count for the grid shown behind a selected control's panel — the control's own
    // domain, which may differ from the route's activeDomain when reached via the
    // detail route (deep-link / mobile drill-down).
    const controlDomain = controlData?.domain;
    const controlDomainCount = useMemo(
        () => (domainCountsLoaded ? (domainCounts.find((c) => c.domain === controlDomain)?.controlCount ?? 0) : undefined),
        [domainCounts, domainCountsLoaded, controlDomain]
    );

    const detailContent = interfaceData ? (
        <InterfaceDetailSection interfaceData={interfaceData} />
    ) : adrData ? (
        <AdrRenderer adrDetails={adrData} />
    ) : isDiagramView ? (
        <DiagramSection
            data={data}
            onItemSelect={handleItemSelect}
            hasDetailsPanel={!!selectedItem}
            breadcrumbs={breadcrumbs}
            onDisplayNameChange={handleDisplayNameChange}
        />
    ) : (
        <DocumentDetailSection data={data} />
    );

    // Route decides the content pane. A loaded resource (including an in-place
    // interface selected from the namespace page) takes precedence over the
    // route-driven page so its detail view shows. A selected control is the
    // exception: it keeps its domain's card grid as the backdrop and opens the
    // ControlPanel beside it (below) rather than replacing the pane — this holds
    // whether the control was selected in-place on /domain/:domain OR reached via
    // the detail route (deep-link / mobile drill-down), so the grid is never blank
    // behind the panel and closing returns to it. With nothing loaded and no
    // namespace/domain route (i.e. `/`), the first-run landing fills what was the
    // ~75% blank canvas (redesign problem #7).
    const content = controlData ? (
        <DomainPage
            domain={controlData.domain}
            controlCount={controlDomainCount}
            onControlLoad={handleControlActivate}
            selectedControlId={controlData.controlId}
        />
    ) : isDetailRoute && resourceLoadFailed && !interfaceData && !adrData && !data ? (
        // The routed resource failed to load: show a recoverable not-found state
        // (never a blank pane). Loaded data wins if a late success ever lands.
        <ResourceNotFound
            namespace={detailMatch.params.namespace!}
            id={detailMatch.params.id!}
            version={detailMatch.params.version!}
            type={detailMatch.params.type}
            breadcrumbs={breadcrumbs}
        />
    ) : isDetailRoute || interfaceData || adrData || data ? (
        detailContent
    ) : activeNamespace ? (
        <NamespacePage namespace={activeNamespace} counts={activeNamespaceCounts} />
    ) : activeDomain ? (
        <DomainPage
            domain={activeDomain}
            controlCount={domainControlCount}
            onControlLoad={handleControlLoad}
        />
    ) : (
        <FirstRunLanding
            namespaceCounts={namespaceCounts}
            domainCounts={domainCounts}
            // Ready only once both fetches have settled AND the namespace fetch didn't
            // fail: the tiles include a Controls total from domainCounts, and a failed
            // namespace fetch is unknown, not zero — hold the placeholder in both cases.
            countsLoaded={namespaceCountsLoaded && domainCountsLoaded && !namespaceCountsFailed}
        />
    );

    return (
        <DiagramActionsContext.Provider value={diagramActions}>
        <div className="flex flex-col h-screen overflow-hidden">
            <Navbar />
            {isMobile && !isMobileNavOpen && (
                <button
                    aria-label="Explore"
                    className="w-full flex items-center gap-2 px-4 py-2 bg-base-200 border-b border-base-300 text-sm text-primary"
                    onClick={() => setIsMobileNavOpen(true)}
                >
                    <IoCompassOutline size={16} />
                    <span>Explore</span>
                </button>
            )}
            <div className="relative flex flex-row flex-1 overflow-hidden bg-base-300">
                {/* Desktop: inline, collapsible browse rail. */}
                {!isMobile && (
                    <div className={`h-full shrink-0 ${isSidebarOpen ? '' : 'w-12 p-4 pr-2'} transition-all duration-300`}>
                        {isSidebarOpen ? (
                            <ExploreRail
                                namespaceCounts={namespaceCounts}
                                domainCounts={domainCounts}
                                onCollapse={() => setIsSidebarOpen(false)}
                            />
                        ) : (
                            <div className="h-full bg-base-100 rounded-box overflow-hidden shadow-xl flex flex-col">
                                <div className="flex items-center justify-center pt-3">
                                    <button
                                        aria-label="Expand sidebar"
                                        className="btn btn-ghost btn-xs btn-circle"
                                        onClick={() => setIsSidebarOpen(true)}
                                    >
                                        <IoChevronForwardOutline />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Mobile: drill-down navigation panel that slides in from the left,
                    anchored below the Explore bar. Kept mounted (slid off screen) so
                    the panel's own list state survives while closed. Deep-link
                    loading is owned by Hub's useResourceFromRoute, not this panel. */}
                {isMobile && (
                    <div
                        className={`absolute inset-0 z-40 bg-base-100 flex flex-col transition-transform duration-300 ${isMobileNavOpen ? 'translate-y-0' : '-translate-y-full pointer-events-none'}`}
                        role="dialog"
                        aria-modal={isMobileNavOpen}
                        aria-hidden={!isMobileNavOpen}
                    >
                        <div className="flex-1 min-h-0 overflow-hidden">
                            <MobileNavMenu
                                namespaceCounts={namespaceCounts}
                                domainCounts={domainCounts}
                                onClose={() => setIsMobileNavOpen(false)}
                            />
                        </div>
                    </div>
                )}

                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <div className="flex-1 overflow-auto min-w-0">{content}</div>
                </div>

                {selectedItem &&
                    isDiagramView &&
                    (isMobile ? (
                        // Mobile: bottom-sheet that keeps the diagram peeking above
                        // (Frame G), replacing the old full-screen takeover.
                        <NodeSheet selectedData={selectedItem.data} closeSheet={closeSidebar} onPrev={onPrevNode} onNext={onNextNode} />
                    ) : (
                        <Sidebar selectedData={selectedItem.data} closeSidebar={closeSidebar} />
                    ))}

                {/* Selected control opens a detail panel beside the domain card grid
                    — the control-domain counterpart of the diagram's node Sidebar.
                    Desktop: inline right column. Mobile: full-screen takeover. The
                    grid stays mounted, so closing returns to it (not "back"). */}
                {controlData && (
                    // One stable element type across the breakpoint so a resize past it
                    // doesn't remount the panel (which would reset the view mode / refetch).
                    // On desktop the wrapper is layout-transparent (display:contents); on
                    // mobile it's the full-screen overlay dialog. The key resets the panel's
                    // view mode when the selected control changes.
                    <div
                        className={
                            isMobile
                                ? 'fixed inset-0 z-40 bg-base-100 animate-slide-in-right flex flex-col'
                                : 'contents'
                        }
                        {...(isMobile
                            ? { role: 'dialog', 'aria-modal': true, 'aria-label': 'Control details' }
                            : {})}
                    >
                        <ControlPanel
                            key={controlData.controlId}
                            controlData={controlData}
                            onClose={handleControlClose}
                        />
                    </div>
                )}
            </div>
        </div>
        </DiagramActionsContext.Provider>
    );
}
