import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useLocation, useMatch, useNavigate } from 'react-router-dom';
import { IoChevronForwardOutline, IoCompassOutline } from 'react-icons/io5';
import { ExploreRail } from './components/explore-rail/ExploreRail.js';
import { MobileNavMenu } from './components/tree-navigation/MobileNavMenu.js';
import { NamespacePage } from './components/namespace-page/NamespacePage.js';
import { DomainPage } from './components/domain-page/DomainPage.js';
import { FirstRunLanding } from './components/first-run-landing/FirstRunLanding.js';
import { useResourceFromRoute } from './hooks/useResourceFromRoute.js';
import { useIsMobile } from '../hooks/useMediaQuery.js';
import { Data, Adr } from '../model/calm.js';
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
import type { SelectedItem } from '../visualizer/contracts/contracts.js';
import type { CalmNodeSchema } from '@finos/calm-models/types';
import { authStore } from '../service/utils/auth-store.js';
import './Hub.css';

export default function Hub() {
    const [data, setData] = useState<Data | undefined>();
    const [adrData, setAdrData] = useState<Adr | undefined>();
    const [controlData, setControlData] = useState<ControlData | undefined>();
    const [interfaceData, setInterfaceData] = useState<InterfaceData | undefined>();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(true);
    const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
    const [namespaceCounts, setNamespaceCounts] = useState<NamespaceCounts[]>([]);
    const [namespaceCountsLoaded, setNamespaceCountsLoaded] = useState(false);
    const [domainCounts, setDomainCounts] = useState<DomainControlCount[]>([]);
    const isMobile = useIsMobile();

    // Route-first content selection (redesign problem #4): the same <Hub/> element
    // is reused across `/`, `/namespace/:ns`, `/domain/:domain` and the detail
    // route, so the URL — not residual state — decides what renders.
    const { key: locationKey } = useLocation();
    const navigate = useNavigate();
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
            .catch(() => setNamespaceCounts([]))
            // Mark loaded on success or failure so consumers can tell "counts
            // unknown (loading)" from "known zero" — an absent namespace after the
            // fetch settles is genuinely zero, not still loading.
            .finally(() => setNamespaceCountsLoaded(true));
        countsService
            .fetchDomainCounts()
            .then(setDomainCounts)
            .catch(() => setDomainCounts([]));
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
    }, [locationKey]);

    const handleDataLoad = useCallback((loaded: Data) => {
        setData(loaded);
        setAdrData(undefined);
        setControlData(undefined);
        setInterfaceData(undefined);
        setSelectedItem(null);
        setIsMobileNavOpen(false);
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

    // Single owner of deep-link / external-navigation loading for the detail route.
    useResourceFromRoute({
        onDataLoad: handleDataLoad,
        onAdrLoad: handleAdrLoad,
        onControlLoad: handleControlLoad,
        onInterfaceLoad: handleInterfaceLoad,
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

    const isDiagramView = data?.calmType === 'Architectures' || data?.calmType === 'Patterns';

    // Mobile node bottom-sheet prev/next steppers (Frame G). The ordered node list
    // is already in Hub — it's exactly what the Drawer renders (`data.data.nodes`)
    // — so steppers need no new prop threading and never touch the desktop drawer.
    // Architecture-only (its `nodes` is a flat array; patterns nest them under
    // `properties.nodes` and degrade to no steppers) and node-only (a selected edge
    // has no place in the node list, so the neighbours resolve to undefined).
    const diagramNodes = useMemo<CalmNodeSchema[]>(() => {
        const nodes = (data?.data as { nodes?: unknown } | undefined)?.nodes;
        return Array.isArray(nodes) ? (nodes as CalmNodeSchema[]) : [];
    }, [data]);

    const selectedNodeIndex = useMemo(() => {
        const selected = selectedItem?.data;
        if (!selected || !('node-type' in selected)) return -1;
        const id = selected['unique-id'];
        return diagramNodes.findIndex((n) => n['unique-id'] === id);
    }, [selectedItem, diagramNodes]);

    const stepToNode = useCallback(
        (index: number) => {
            const node = diagramNodes[index];
            if (node) setSelectedItem({ data: node });
        },
        [diagramNodes]
    );

    const onPrevNode = selectedNodeIndex > 0 ? () => stepToNode(selectedNodeIndex - 1) : undefined;
    const onNextNode =
        selectedNodeIndex >= 0 && selectedNodeIndex < diagramNodes.length - 1 ? () => stepToNode(selectedNodeIndex + 1) : undefined;

    // The active namespace's full per-type counts, passed straight to NamespacePage
    // so its type tabs show counts without a second fetch. `undefined` while the
    // counts fetch is in flight — distinct from a known all-zero record — so the
    // page can render tabs resting (not dimmed) and defer the first-non-empty
    // default until counts resolve. Once loaded, a namespace absent from the list
    // is a genuine all-zero (e.g. an unknown namespace), not still loading.
    const activeNamespaceCounts = useMemo<NamespaceCounts | undefined>(() => {
        if (!namespaceCountsLoaded) return undefined;
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
    }, [namespaceCounts, namespaceCountsLoaded, activeNamespace]);
    const domainControlCount = useMemo(
        () => domainCounts.find((c) => c.domain === activeDomain)?.controlCount ?? 0,
        [domainCounts, activeDomain]
    );
    // Count for the grid shown behind a selected control's panel — the control's own
    // domain, which may differ from the route's activeDomain when reached via the
    // detail route (deep-link / mobile drill-down).
    const controlDomain = controlData?.domain;
    const controlDomainCount = useMemo(
        () => domainCounts.find((c) => c.domain === controlDomain)?.controlCount ?? 0,
        [domainCounts, controlDomain]
    );

    const detailContent = interfaceData ? (
        <InterfaceDetailSection interfaceData={interfaceData} />
    ) : adrData ? (
        <AdrRenderer adrDetails={adrData} />
    ) : isDiagramView ? (
        <DiagramSection data={data} onItemSelect={handleItemSelect} hasDetailsPanel={!!selectedItem} />
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
            onControlLoad={handleControlLoad}
            selectedControlId={controlData.controlId}
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
            selectedControlId={controlData?.controlId}
        />
    ) : (
        <FirstRunLanding namespaceCounts={namespaceCounts} domainCounts={domainCounts} countsLoaded={namespaceCountsLoaded} />
    );

    return (
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
                {controlData &&
                    (isMobile ? (
                        <div
                            className="fixed inset-0 z-40 bg-base-100 animate-slide-in-right flex flex-col"
                            role="dialog"
                            aria-modal="true"
                        >
                            <ControlPanel controlData={controlData} onClose={handleControlClose} />
                        </div>
                    ) : (
                        <ControlPanel controlData={controlData} onClose={handleControlClose} />
                    ))}
            </div>
        </div>
    );
}
