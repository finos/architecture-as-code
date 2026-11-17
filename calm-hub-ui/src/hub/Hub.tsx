import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useMatch, useNavigate } from 'react-router-dom';
import { IoCompassOutline } from 'react-icons/io5';
import { ExtensionResourceContext } from '../extensions/ExtensionResourceContext.js';
import { RESOURCE_ROUTE } from './routes.js';
import { ExploreRail } from './components/explore-rail/ExploreRail.js';
import { CollapsedRail } from './components/explore-rail/CollapsedRail.js';
import { MobileNavMenu } from './components/tree-navigation/MobileNavMenu.js';
import { NamespacePage } from './components/namespace-page/NamespacePage.js';
import { DomainPage } from './components/domain-page/DomainPage.js';
import { IntroScreen } from './components/intro-screen/IntroScreen.js';
import { SearchResultsPage } from './components/search-results/SearchResultsPage.js';
import { useResourceFromRoute } from './hooks/useResourceFromRoute.js';
import { useResourceNavigationKey } from './hooks/useResourceNavigationKey.js';
import { PersonalNamespaceControl, usePersonalNamespace } from './hooks/usePersonalNamespace.js';
import { useIsMobile } from '../hooks/useMediaQuery.js';
import { BreadcrumbItem, Data, Adr } from '../model/calm.js';
import { ControlData } from '../model/control.js';
import { InterfaceData } from '../model/interface.js';
import { NamespaceCounts, DomainControlCount } from '../model/counts.js';
import { CountsService } from '../service/counts-service.js';
import { hideEmptyPersonalRoot } from '../model/personal-namespace.js';
import { AppLayout } from '../components/navigation/AppLayout.js';
import { useNavigationSettings } from '../components/navigation/navigation-settings.js';
import { AdrRenderer } from './components/adr-renderer/AdrRenderer.js';
import { DocumentDetailSection } from './components/document-detail-section/DocumentDetailSection.js';
import { ControlPanel } from './components/control-detail-section/ControlPanel.js';
import { InterfaceDetailSection } from './components/interface-detail-section/InterfaceDetailSection.js';
import { DiagramSection } from './components/diagram-section/DiagramSection.js';
import { Sidebar } from '../visualizer/components/sidebar/Sidebar.js';
import { NodeSheet } from '../visualizer/components/sidebar/NodeSheet.js';
import { DiagramActionsContext } from '../visualizer/context/DiagramActionsContext.js';
import { DecoratorsContext, type DecoratorsState } from '../visualizer/context/DecoratorsContext.js';
import { containersOfContainment } from '../visualizer/overlay/overlayEngine.js';
import { ResourceNotFound } from './components/resource-not-found/ResourceNotFound.js';
import { extensionContext } from './components/diagram-section/tabs/diagramTabs.js';
import { parseCALMHubPath } from '../visualizer/components/reactflow/utils/calmHelpers.js';
import type { Decorator, SelectedItem } from '../visualizer/contracts/contracts.js';
import type { CalmNodeSchema } from '@finos/calm-models/types';
import { authStore } from '../service/utils/auth-store.js';
import { diagramLenses } from './components/diagram-section/tabs/diagramLenses.js';
import { useExtensions, useExtensionsStatus } from '../extensions/ExtensionsContext.js';
import { EXTENSION_PARAM, withoutLens } from './components/diagram-section/tabs/diagramTabRegistry.js';
import { resourceExtensions } from '../extensions/contributions.js';
import { ReturnPointProvider } from '../navigation/ReturnPointProvider.js';
import { carryReturnPoints, type ReturnPage } from '../navigation/returnPoints.js';
import { ReturnBar } from './components/return-bar/ReturnBar.js';
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

/** The node or relationship with this unique-id in an architecture or pattern document, if it has one at the top level. */
function findElement(data: Data | undefined, uniqueId: string | null): CalmNodeSchema | undefined {
    if (!data || !uniqueId) return undefined;
    const document = data.data as { nodes?: unknown; relationships?: unknown } | undefined;
    const items = [document?.nodes, document?.relationships].flatMap((list) => (Array.isArray(list) ? list : []));
    return (items as CalmNodeSchema[]).find((entry) => entry?.['unique-id'] === uniqueId);
}

export default function Hub() {
    const navigate = useNavigate();
    const location = useLocation();
    const extensions = useExtensions();
    const extensionsStatus = useExtensionsStatus();
    const lenses = useMemo(() => diagramLenses(extensions, extensionsStatus), [extensions, extensionsStatus]);
    const lensFreeQuery = (search: string) => withoutLens(lenses, new URLSearchParams(search)).toString();
    const currentDisplayNameRef = useRef<string | undefined>(undefined);
    const [data, setData] = useState<Data | undefined>();
    const [adrData, setAdrData] = useState<Adr | undefined>();
    const [controlData, setControlData] = useState<ControlData | undefined>();
    const [interfaceData, setInterfaceData] = useState<InterfaceData | undefined>();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(true);
    const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
    const [showsDroppedFile, setShowsDroppedFile] = useState(false);
    // The selection can be a node of the dropped file, so it goes with the file. Set together, so that no render gives
    // extensions that node with the loaded architecture's context.
    const showsDroppedFileRef = useRef(false);
    const handleDroppedFileChange = useCallback((dropped: boolean) => {
        if (showsDroppedFileRef.current && !dropped) setSelectedItem(null);
        showsDroppedFileRef.current = dropped;
        setShowsDroppedFile(dropped);
    }, []);
    // Reported by DiagramSection, which fetches them, for the details drawer.
    const [decorators, setDecorators] = useState<Decorator[]>([]);
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
    // Mirrors namespaceCountsFailed above — a failed fetch means "unknown", not "zero".
    const [domainCountsFailed, setDomainCountsFailed] = useState(false);
    const isMobile = useIsMobile();
    const navigation = useNavigationSettings();
    const showExplore = navigation.showNamespaces || navigation.showControlDomains;

    // Route-first content selection (redesign problem #4): the same <Hub/> element
    // is reused across `/`, `/namespace/:ns`, `/domain/:domain` and the detail
    // route, so the URL — not residual state — decides what renders.
    const namespaceMatch = useMatch('/namespace/:ns');
    const domainMatch = useMatch('/domain/:domain');
    const detailMatch = useMatch(RESOURCE_ROUTE);
    const searchMatch = useMatch('/search');
    const brokenRefMatch = useMatch('/broken-reference');
    const activeNamespace = namespaceMatch?.params.ns;
    const activeDomain = domainMatch?.params.domain;
    const isDetailRoute = detailMatch !== null;
    const isSearchRoute = searchMatch !== null;
    const isBrokenRefRoute = brokenRefMatch !== null;
    // The malformed ref that landed us on /broken-reference, carried in history
    // state (like breadcrumbs, and equally untyped — validate, don't cast).
    const brokenRefState = (location.state as { brokenRef?: unknown } | null)?.brokenRef;
    const brokenRef = typeof brokenRefState === 'string' ? brokenRefState : undefined;

    const countsService = useMemo(() => new CountsService(), []);

    const loadNamespaceCounts = useCallback(() => {
        countsService
            .fetchNamespaceCounts()
            .then((counts) => {
                setNamespaceCounts(counts);
                setNamespaceCountsFailed(false);
            })
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
    }, [countsService]);

    // Runs once: countsService is memoised and Hub is the top-level page, so this effect
    // never re-fires and there is no in-flight fetch to cancel on a dependency change. (Unlike
    // useNamespaceItems, whose fetch effect re-runs per namespace and so needs a cancel guard.)
    useEffect(() => {
        loadNamespaceCounts();
        countsService
            .fetchDomainCounts()
            .then(setDomainCounts)
            .catch(() => {
                setDomainCounts([]);
                setDomainCountsFailed(true);
            })
            .finally(() => setDomainCountsLoaded(true));
    }, [countsService, loadNamespaceCounts]);

    const personalNamespaceControl = usePersonalNamespace();
    const { create: createPersonalNamespace } = personalNamespaceControl;
    // A new personal namespace must appear in the browse grid and the rail, so counts reload.
    const createAndReload = useCallback(async () => {
        const created = await createPersonalNamespace();
        if (created) loadNamespaceCounts();
        return created;
    }, [createPersonalNamespace, loadNamespaceCounts]);
    const personalNamespace = useMemo<PersonalNamespaceControl>(
        () => ({ ...personalNamespaceControl, create: createAndReload }),
        [personalNamespaceControl, createAndReload]
    );
    const visibleNamespaceCounts = useMemo(
        () => hideEmptyPersonalRoot(namespaceCounts, personalNamespace.state),
        [namespaceCounts, personalNamespace.state]
    );

    // The mobile drill-down overlay defaults open and would otherwise cover the
    // results on /search. Close it on route entry (during render, so a direct
    // mobile /search load doesn't flash the overlay); the Explore bar can reopen it.
    const [wasSearchRoute, setWasSearchRoute] = useState(false);
    if (isSearchRoute !== wasSearchRoute) {
        setWasSearchRoute(isSearchRoute);
        if (isSearchRoute) setIsMobileNavOpen(false);
    }
    // Without namespaces and control domains the drill-down has only its search, so it does not open by itself.
    const [exploreShown, setExploreShown] = useState(true);
    if (showExplore !== exploreShown) {
        setExploreShown(showExplore);
        if (!showExplore) setIsMobileNavOpen(false);
    }

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
    // renders. Every resource load now comes from the route, so a stale control or
    // interface would otherwise flash before the new fetch resolves (detailContent
    // evaluates controlData first). The clear happens during render, so a stale panel
    // never paints. A change to the query only, such as a diagram tab, keeps the
    // resource (useResourceNavigationKey).
    const resourceKey = useResourceNavigationKey(location, resourceLoadFailed);
    const [clearedForKey, setClearedForKey] = useState(resourceKey);
    if (resourceKey !== clearedForKey) {
        setClearedForKey(resourceKey);
        setData(undefined);
        setAdrData(undefined);
        setControlData(undefined);
        setInterfaceData(undefined);
        setResourceLoadFailed(false);
    }

    // Any navigation, a tab change included, closes the node details panel, except the one that
    // handleItemSelect makes to take `node` out of the URL, and a change of only the diagram lens or its parameters.
    const [nodeRemovedFromUrl, setNodeRemovedFromUrl] = useState<string | null>(null);
    const [selectionLocation, setSelectionLocation] = useState({ key: location.key, search: location.search });
    if (selectionLocation.key !== location.key || selectionLocation.search !== location.search) {
        const lensChangeOnly = selectionLocation.search !== location.search
            && lensFreeQuery(selectionLocation.search) === lensFreeQuery(location.search);
        setSelectionLocation({ key: location.key, search: location.search });
        setNodeRemovedFromUrl(null);
        if (!lensChangeOnly && nodeRemovedFromUrl !== location.search) setSelectedItem(null);
    }

    // A link can name a node to open: `#/ns/architectures/1/1.0.0?node=client-ledger`. This comes after
    // the clear above, so a link to another node replaces the cleared selection. A lens can name a relationship
    // there too, because a lens element can stand for one.
    const linkedNodeId = new URLSearchParams(location.search).get('node');
    const [linkSource, setLinkSource] = useState({ data, linkedNodeId, key: location.key });
    if (linkSource.data !== data || linkSource.linkedNodeId !== linkedNodeId || linkSource.key !== location.key) {
        setLinkSource({ data, linkedNodeId, key: location.key });
        const item = findElement(data, linkedNodeId);
        if (item) setSelectedItem({ data: item });
    }

    // The name of the loaded resource, for the label of its return point. Reported by DiagramSection.
    const [displayName, setDisplayName] = useState<string | undefined>();

    const handleDataLoad = useCallback((loaded: Data) => {
        setData(loaded);
        setAdrData(undefined);
        setControlData(undefined);
        setInterfaceData(undefined);
        setSelectedItem(null);
        setIsMobileNavOpen(false);
        currentDisplayNameRef.current = undefined;
        setDisplayName(undefined);
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
        resourceKey,
        onDataLoad: handleDataLoad,
        onAdrLoad: handleAdrLoad,
        onControlLoad: handleControlLoad,
        onInterfaceLoad: handleInterfaceLoad,
        onLoadError: handleResourceLoadError,
    });

    // handleItemSelect must stay stable, because the diagram lays out its nodes again when its click handler
    // changes. A layout effect, so a click just after a navigation reads the new location.
    const locationRef = useRef(location);
    useLayoutEffect(() => {
        locationRef.current = location;
    });

    // When the user selects another item or closes the panel, the URL stops naming the linked node, so a
    // copied link or a reload does not open it again.
    const handleItemSelect = useCallback(
        (item: SelectedItem) => {
            setSelectedItem(item);
            const { pathname, search, hash, state } = locationRef.current;
            const params = new URLSearchParams(search);
            const linked = params.get('node');
            if (!linked || item?.data['unique-id'] === linked) return;
            params.delete('node');
            const query = params.toString();
            const nextSearch = query ? `?${query}` : '';
            setNodeRemovedFromUrl(nextSearch);
            navigate({ pathname, search: nextSearch, hash }, { replace: true, state });
        },
        [navigate]
    );

    const closeSidebar = useCallback(() => handleItemSelect(null), [handleItemSelect]);

    // The resource's display name is fetched by DiagramSection (it owns the
    // summaries fetch) and mirrored here so the crumb pushed on navigation can
    // carry it, and the return point of the page can name it. This handler MUST stay memoised
    // (identity-stable) — DiagramSection lists it in a fetch effect's deps.
    const handleDisplayNameChange = useCallback((name: string | undefined) => {
        currentDisplayNameRef.current = name;
        setDisplayName(name);
    }, []);

    const handleNavigateToDetailedArch = useCallback((ref: string) => {
        if (!data) return;
        const currentCrumb: BreadcrumbItem = {
            namespace: data.name,
            type: data.calmType === 'Architectures' ? 'architectures' : 'patterns',
            id: data.id,
            version: data.version,
            name: currentDisplayNameRef.current,
        };
        const breadcrumbs = [...readBreadcrumbs(location.state), currentCrumb];
        const parsed = parseCALMHubPath(ref);
        if (parsed) {
            navigate(`/${parsed.namespace}/${parsed.type}/${parsed.id}/${parsed.version}`, {
                state: { ...carryReturnPoints(location.state), breadcrumbs }
            });
        } else {
            // A same-host ref the router cannot parse (an 'invalid' resolution,
            // e.g. a missing id segment): land on the in-app not-found view so
            // the broken reference is explained with a recovery path.
            navigate('/broken-reference', { state: { ...carryReturnPoints(location.state), breadcrumbs, brokenRef: ref } });
        }
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
    // Memoised: a new object on each render would re-render each consumer and restart its effects.
    const resourceContext = useMemo(
        () => (data && isDiagramView && !showsDroppedFile ? extensionContext(data) : null),
        [data, isDiagramView, showsDroppedFile]
    );

    const decoratorsState = useMemo(
        (): DecoratorsState => ({
            decorators,
            drawnAs: containersOfContainment((data?.data as { relationships?: unknown } | undefined)?.relationships),
        }),
        [data, decorators]
    );

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
        if (node) handleItemSelect({ data: node });
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
    // Both counts stay `undefined` until the domain-counts fetch settles OR if it
    // failed, so a deep-link shows "controls" rather than a misleading "0 controls"
    // (mirrors the activeNamespaceCounts gate above).
    const domainControlCount = useMemo(
        () =>
            !domainCountsLoaded || domainCountsFailed
                ? undefined
                : (domainCounts.find((c) => c.domain === activeDomain)?.controlCount ?? 0),
        [domainCounts, domainCountsLoaded, domainCountsFailed, activeDomain]
    );

    // The page that links on it record as their return point, with the selected node, so a return opens it again.
    const returnPage: ReturnPage | undefined = detailMatch
        ? {
              kind: 'resource',
              namespace: detailMatch.params.namespace!,
              type: detailMatch.params.type!,
              id: detailMatch.params.id!,
              version: detailMatch.params.version!,
          }
        : isSearchRoute
          ? { kind: 'search' }
          : undefined;
    const returnQuery = new URLSearchParams(location.search);
    const selectedId = showsDroppedFile ? undefined : selectedItem?.data['unique-id'];
    if (selectedId) returnQuery.set('node', selectedId);
    const returnSearch = returnQuery.toString() ? `?${returnQuery.toString()}` : '';
    const returnLabel = detailMatch
        ? `${displayName || detailMatch.params.id} ${detailMatch.params.version}`
        : 'search results';

    // The parts of a link that this page cannot show. The page itself shows; access is checked when each part loads.
    const linkNotices: string[] = [];
    if (data && !showsDroppedFile && isDetailRoute) {
        if (linkedNodeId && data.calmType === 'Architectures' && !findElement(data, linkedNodeId)) {
            linkNotices.push(`The element "${linkedNodeId}" is not in version ${data.version} of this architecture.`);
        }
        const linkedExtension = new URLSearchParams(location.search).get(EXTENSION_PARAM);
        if (linkedExtension && isDiagramView) {
            if (extensionsStatus === 'failed' || extensionsStatus === 'signed-out') {
                linkNotices.push(`Extensions could not be loaded, so the "${linkedExtension}" view is not shown.`);
            } else if (
                extensionsStatus === 'loaded' &&
                !resourceExtensions(extensions, extensionContext(data)).some(({ extension }) => extension.id === linkedExtension)
            ) {
                linkNotices.push(`The extension "${linkedExtension}" is not enabled in this Hub, or has no view for this resource.`);
            }
        }
    }

    // Chrome-free intro / front door (`/` with nothing else active): early-returns
    // before Hub's navbar + rail layout. Below every hook above, so none is skipped.
    if (
        !activeNamespace &&
        !activeDomain &&
        !isDetailRoute &&
        !isSearchRoute &&
        !isBrokenRefRoute &&
        !data &&
        !adrData &&
        !controlData &&
        !interfaceData
    ) {
        // The sidebar layout keeps its navigation on the home page too.
        if (navigation.layout === 'sidebar') {
            return (
                <AppLayout>
                    <IntroScreen
                        embedded
                        namespaceCounts={visibleNamespaceCounts}
                        domainCounts={domainCounts}
                        personalNamespace={personalNamespace}
                    />
                </AppLayout>
            );
        }
        return (
            <IntroScreen
                namespaceCounts={visibleNamespaceCounts}
                domainCounts={domainCounts}
                personalNamespace={personalNamespace}
            />
        );
    }

    const detailContent = interfaceData ? (
        <InterfaceDetailSection interfaceData={interfaceData} />
    ) : adrData ? (
        <AdrRenderer adrDetails={adrData} />
    ) : isDiagramView ? (
        <DiagramSection
            // Forces a full remount on navigating between diagrams (not just a
            // data-prop update), so DiagramSection's own transient state —
            // notably `latestPositionsRef`, which "Save as default layout" reads
            // from — never carries over from the previously-viewed diagram.
            // Without this, a fast navigation to a new architecture could let
            // "Save as default layout" persist the previous architecture's
            // on-screen positions under the new architecture's key.
            key={`${data.calmType}:${data.name}:${data.id}`}
            data={data}
            onItemSelect={handleItemSelect}
            hasDetailsPanel={!!selectedItem}
            selectedElement={selectedItem?.data['unique-id']}
            breadcrumbs={breadcrumbs}
            onDisplayNameChange={handleDisplayNameChange}
            onDecoratorsChange={setDecorators}
            onDroppedFileChange={handleDroppedFileChange}
        />
    ) : (
        <DocumentDetailSection data={data} />
    );

    // Route decides the content pane. A resource loaded from a detail route takes
    // precedence over the route-driven page so its detail view shows. A loaded control
    // fills the whole pane like an architecture or document detail view — the
    // ControlPanel carries its own breadcrumb (Explore / <domain> / <control>) back to
    // the domain's control list. The key resets the panel's view mode when the
    // control changes.
    const content = controlData ? (
        <ControlPanel key={controlData.controlId} controlData={controlData} />
    ) : isBrokenRefRoute ? (
        // A malformed detailed-architecture ref (missing/extra segments): the
        // raw ref cannot be split into route segments, so echo it verbatim.
        <ResourceNotFound kind="ref" refPath={brokenRef} breadcrumbs={breadcrumbs} />
    ) : isDetailRoute && resourceLoadFailed && !interfaceData && !adrData && !data ? (
        // The routed resource failed to load: show a recoverable not-found state
        // (never a blank pane). Loaded data wins if a late success ever lands.
        <ResourceNotFound
            kind="route"
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
        />
    ) : (
        // Only reached on `/search` (the bare-`/` intro early-returns above).
        <SearchResultsPage />
    );

    return (
        <DiagramActionsContext.Provider value={diagramActions}>
        <ExtensionResourceContext.Provider value={resourceContext}>
        <DecoratorsContext.Provider value={decoratorsState}>
        <ReturnPointProvider page={returnPage} label={returnLabel} search={returnSearch}>
        <AppLayout>
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
                {/* Desktop: inline, collapsible browse rail. Hidden when the operator hides both of its sections. */}
                {!isMobile && showExplore && (
                    <div className={`h-full shrink-0 ${isSidebarOpen ? '' : 'w-12'} transition-all duration-300`}>
                        {isSidebarOpen ? (
                            <ExploreRail
                                namespaceCounts={visibleNamespaceCounts}
                                domainCounts={domainCounts}
                                namespacesLoading={!namespaceCountsLoaded}
                                domainsLoading={!domainCountsLoaded}
                                namespacesFailed={namespaceCountsFailed}
                                domainsFailed={domainCountsFailed}
                                onCollapse={() => setIsSidebarOpen(false)}
                            />
                        ) : (
                            <CollapsedRail
                                namespaceCounts={navigation.showNamespaces ? visibleNamespaceCounts : []}
                                onExpand={() => setIsSidebarOpen(true)}
                            />
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
                                namespaceCounts={visibleNamespaceCounts}
                                domainCounts={domainCounts}
                                namespacesLoading={!namespaceCountsLoaded}
                                domainsLoading={!domainCountsLoaded}
                                namespacesFailed={namespaceCountsFailed}
                                domainsFailed={domainCountsFailed}
                                onClose={() => setIsMobileNavOpen(false)}
                            />
                        </div>
                    </div>
                )}

                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <ReturnBar notices={linkNotices} />
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

            </div>
        </AppLayout>
        </ReturnPointProvider>
        </DecoratorsContext.Provider>
        </ExtensionResourceContext.Provider>
        </DiagramActionsContext.Provider>
    );
}
