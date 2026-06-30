import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useLocation, useMatch } from 'react-router-dom';
import { IoChevronForwardOutline, IoCompassOutline } from 'react-icons/io5';
import { ExploreRail } from './components/explore-rail/ExploreRail.js';
import { MobileNavMenu } from './components/tree-navigation/MobileNavMenu.js';
import { NamespacePage } from './components/namespace-page/NamespacePage.js';
import { DomainPage } from './components/domain-page/DomainPage.js';
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
import { ControlDetailSection } from './components/control-detail-section/ControlDetailSection.js';
import { InterfaceDetailSection } from './components/interface-detail-section/InterfaceDetailSection.js';
import { DiagramSection } from './components/diagram-section/DiagramSection.js';
import { Sidebar } from '../visualizer/components/sidebar/Sidebar.js';
import type { SelectedItem } from '../visualizer/contracts/contracts.js';
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
    const [domainCounts, setDomainCounts] = useState<DomainControlCount[]>([]);
    const isMobile = useIsMobile();

    // Route-first content selection (redesign problem #4): the same <Hub/> element
    // is reused across `/`, `/namespace/:ns`, `/domain/:domain` and the detail
    // route, so the URL — not residual state — decides what renders.
    const { key: locationKey } = useLocation();
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
        countsService.fetchNamespaceCounts().then(setNamespaceCounts).catch(() => setNamespaceCounts([]));
        countsService.fetchDomainCounts().then(setDomainCounts).catch(() => setDomainCounts([]));
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

    // Navigating to a non-detail route clears any loaded resource so namespace /
    // domain pages (and the empty landing) don't show a stale detail panel. Keyed
    // on react-router's location.key (which changes on every navigation, including
    // re-selecting the already-active rail row) rather than pathname: an in-place
    // control / interface load does not navigate, so its key is unchanged and the
    // detail is preserved, while any navigation clears stale detail state. Runs in
    // a layout effect so the clear happens before paint, avoiding a one-frame flash
    // of the stale panel.
    useLayoutEffect(() => {
        if (!isDetailRoute) {
            setData(undefined);
            setAdrData(undefined);
            setControlData(undefined);
            setInterfaceData(undefined);
            setSelectedItem(null);
        }
    }, [locationKey, isDetailRoute]);

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

    const isDiagramView = data?.calmType === 'Architectures' || data?.calmType === 'Patterns';

    const namespaceTotal = useMemo(
        () => namespaceCounts.find((c) => c.namespace === activeNamespace)?.total ?? 0,
        [namespaceCounts, activeNamespace]
    );
    const domainControlCount = useMemo(
        () => domainCounts.find((c) => c.domain === activeDomain)?.controlCount ?? 0,
        [domainCounts, activeDomain]
    );

    const detailContent = interfaceData ? (
        <InterfaceDetailSection interfaceData={interfaceData} />
    ) : controlData ? (
        <ControlDetailSection controlData={controlData} />
    ) : adrData ? (
        <AdrRenderer adrDetails={adrData} />
    ) : isDiagramView ? (
        <DiagramSection data={data} onItemSelect={handleItemSelect} hasDetailsPanel={!!selectedItem} />
    ) : (
        <DocumentDetailSection data={data} />
    );

    // Route decides the content pane. A loaded resource (including an in-place
    // control/interface selected from the domain/namespace page) takes precedence
    // over the route-driven page so its detail view shows.
    const content =
        isDetailRoute || controlData || interfaceData || adrData || data ? (
            detailContent
        ) : activeNamespace ? (
            <NamespacePage namespace={activeNamespace} total={namespaceTotal} />
        ) : activeDomain ? (
            <DomainPage domain={activeDomain} controlCount={domainControlCount} onControlLoad={handleControlLoad} />
        ) : (
            detailContent
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

                {selectedItem && isDiagramView && (
                    isMobile ? (
                        <div
                            className="fixed inset-0 z-40 bg-base-100 animate-slide-in-right"
                            role="dialog"
                            aria-modal="true"
                        >
                            <Sidebar selectedData={selectedItem.data} closeSidebar={closeSidebar} />
                        </div>
                    ) : (
                        <Sidebar selectedData={selectedItem.data} closeSidebar={closeSidebar} />
                    )
                )}
            </div>
        </div>
    );
}
