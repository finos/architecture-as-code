import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavigationType, useLocation, useMatch, useNavigate, useNavigationType } from 'react-router-dom';
import { IoCompassOutline } from 'react-icons/io5';
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
import { readEntrySelection, sessionStore, useBrowserEntry, useLinkKey, writeEntrySelection } from './hooks/entrySelection.js';
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
import { DiagramInspector, MobileInspector } from './components/inspector/DiagramInspector.js';
import { INSPECTOR_ID, type InspectorTab } from './components/inspector/inspectorIds.js';
import { DiagramActionsContext } from '../visualizer/context/DiagramActionsContext.js';
import { DecoratorsContext, type DecoratorsState } from '../visualizer/context/DecoratorsContext.js';
import { containersOfContainment } from '../visualizer/overlay/overlayEngine.js';
import { ResourceNotFound } from './components/resource-not-found/ResourceNotFound.js';
import { extensionContext } from './components/diagram-section/tabs/diagramTabs.js';
import { parseCALMHubPath } from '../visualizer/components/reactflow/utils/calmHelpers.js';
import type { Decorator, SelectedItem } from '../visualizer/contracts/contracts.js';
import type { CalmNodeSchema, CalmRelationshipSchema } from '@finos/calm-models/types';
import { findPatternElement, type SchemaObject } from '../visualizer/components/reactflow/utils/patternTransformer.js';
import { authStore } from '../service/utils/auth-store.js';
import { diagramLenses } from './components/diagram-section/tabs/diagramLenses.js';
import { useExtensions, useExtensionsStatus } from '../extensions/ExtensionsContext.js';
import { ExtensionResourceContext } from '../extensions/ExtensionResourceContext.js';
import { EXTENSION_PARAM, EXTENSIONS_TAB_ID, inspectorExtension, withoutLens } from './components/diagram-section/tabs/diagramTabRegistry.js';
import { resourceExtensions } from '../extensions/contributions.js';
import { SlotHostContext } from '../extensions/slotActivity.js';
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

/**
 * The node or relationship with this unique-id in an architecture or pattern, as the details panel shows it. A pattern
 * declares its elements in JSON Schema, which patternTransformer reads for the diagram too.
 */
function findElement(data: Data | undefined, uniqueId: string | null): CalmNodeSchema | CalmRelationshipSchema | undefined {
    if (!data || !uniqueId) return undefined;
    if (data.calmType === 'Patterns') return data.data ? findPatternElement(data.data as SchemaObject, uniqueId) : undefined;
    const document = data.data as { nodes?: unknown; relationships?: unknown } | undefined;
    const items = [document?.nodes, document?.relationships].flatMap((list) => (Array.isArray(list) ? list : []));
    return (items as CalmNodeSchema[]).find((entry) => entry?.['unique-id'] === uniqueId);
}

/** The query with the inspector open on `extension`, or closed for null. An old `?tab=extensions` link loses its tab. */
function inspectorQuery(search: string, extension: string | null): string {
    const params = new URLSearchParams(search);
    if (params.get('tab') === EXTENSIONS_TAB_ID) params.delete('tab');
    if (extension === null) params.delete(EXTENSION_PARAM);
    else params.set(EXTENSION_PARAM, extension);
    const query = params.toString();
    return query ? `?${query}` : '';
}

/** A replace by Hub of the page's query: the inspector's part, or `node` that a selection takes out. Its id goes in the history state. */
interface InspectorWrite {
    id: string;
    pathname: string;
    search: string;
}

const INSPECTOR_WRITE = 'inspectorWrite';

/** The history state with the id of a write. A state that is not an object stays as it is, with no id. */
function withInspectorWrite(state: unknown, id: string): unknown {
    if (state === null || state === undefined) return { [INSPECTOR_WRITE]: id };
    return typeof state === 'object' && !Array.isArray(state) ? { ...state, [INSPECTOR_WRITE]: id } : state;
}

const inspectorWriteOf = (state: unknown) =>
    state !== null && typeof state === 'object' ? (state as Record<string, unknown>)[INSPECTOR_WRITE] : undefined;

const newWriteId = () => Math.random().toString(36).slice(2, 12);

interface HubProps {
    /** Where the selection of each history entry is kept. Injected for tests; defaults to `sessionStorage`. */
    storage?: Storage;
}

export default function Hub({ storage }: HubProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const extensions = useExtensions();
    const extensionsStatus = useExtensionsStatus();
    const lenses = useMemo(() => diagramLenses(extensions, extensionsStatus), [extensions, extensionsStatus]);
    // The query without the diagram lens and the inspector's extension: a change of only those keeps the selection.
    const viewFreeQuery = (search: string) => {
        const query = withoutLens(lenses, new URLSearchParams(search));
        query.delete(EXTENSION_PARAM);
        if (query.get('tab') === EXTENSIONS_TAB_ID) query.delete('tab');
        return query.toString();
    };
    const [displayName, setDisplayName] = useState<string>();
    const currentDisplayNameRef = useRef<string | undefined>(undefined);
    const [data, setData] = useState<Data | undefined>();
    const [adrData, setAdrData] = useState<Adr | undefined>();
    const [controlData, setControlData] = useState<ControlData | undefined>();
    const [interfaceData, setInterfaceData] = useState<InterfaceData | undefined>();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(true);
    const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
    // Counts the selections that the user makes, so a click on the item that is already selected opens the inspector.
    const [selections, setSelections] = useState(0);
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
    const selectionStorage = storage ?? sessionStore();

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

    // Any navigation, a tab change included, clears the selection, except the one that handleItemSelect makes to take
    // `node` out of the URL, and a change of only the diagram lens, its parameters or the inspector's extension.
    // Back, Forward and a URL that the user opens go to another history entry, which has its own selection: a view
    // change keeps a selection only in the page. A browser move can keep the location (useBrowserEntry).
    const navigationType = useNavigationType();
    const browserEntry = useBrowserEntry();
    const [nodeRemovedFromUrl, setNodeRemovedFromUrl] = useState<string | null>(null);
    const [selectionLocation, setSelectionLocation] = useState({ key: location.key, search: location.search, entry: browserEntry.entry });
    const locationChanged = selectionLocation.key !== location.key || selectionLocation.search !== location.search;
    if (locationChanged || selectionLocation.entry !== browserEntry.entry) {
        const otherEntry = selectionLocation.entry !== browserEntry.entry || navigationType === NavigationType.Pop;
        const viewChangeOnly =
            !otherEntry &&
            selectionLocation.search !== location.search &&
            viewFreeQuery(selectionLocation.search) === viewFreeQuery(location.search);
        setSelectionLocation({ key: location.key, search: location.search, entry: browserEntry.entry });
        setNodeRemovedFromUrl(null);
        if (!viewChangeOnly && nodeRemovedFromUrl !== location.search) setSelectedItem(null);
    }

    // A link can name a node to open: `#/ns/architectures/1/1.0.0?node=client-ledger`. This comes after
    // the clear above, so a link to another node replaces the cleared selection. A lens can name a relationship
    // there too, because a lens element can stand for one. Without a node in the URL, Back or Forward to a history
    // entry opens the node that the user selected on it, which the URL does not name. This runs on each new location
    // and each browser move, the changes that the effect which keeps the selection runs on, so the effect keeps the
    // selection that opens here. The key alone is no such change: the router gives every entry that the browser made
    // the key `default`.
    const linkedNodeId = new URLSearchParams(location.search).get('node');
    const [linkSource, setLinkSource] = useState({ data, location, entry: browserEntry.entry });
    if (linkSource.data !== data || linkSource.location !== location || linkSource.entry !== browserEntry.entry) {
        setLinkSource({ data, location, entry: browserEntry.entry });
        const item = findElement(data, linkedNodeId ?? readEntrySelection(selectionStorage, location) ?? null);
        if (item) setSelectedItem({ data: item });
    }

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
    // A dropped file has no resource, so extensions get no context for it.
    const selectedId = selectedItem?.data['unique-id'];
    const inspectorContext = useMemo(
        () => (data && isDiagramView && !showsDroppedFile ? extensionContext(data, selectedId) : null),
        [data, isDiagramView, showsDroppedFile, selectedId]
    );

    // The inspector beside the diagram. `?extension=<id>` opens it on that extension, so a link and a reload keep it;
    // Details is open in memory only. Hub owns it, so the diagram stays mounted while it opens and closes.
    // The router shows a replace in a transition, so a close or another choice can come before it shows, also while a
    // render of it waits. The user's latest choice shows at once. Each choice is a whole value: an update that reads the
    // state can see a render that has not shown. A choice holds until a navigation that is not Hub's write of the
    // inspector shows (`foreign` counts them); that navigation decides with its URL.
    const [inspectorChoice, setInspectorChoice] = useState<{ extension: string | null; id: string; foreign: number } | null>(null);
    // Hub sends one write at a time, and knows it by the id in its history state, not by its URL. It never sends a write
    // to the URL that shows: that loads the resource again. A choice that goes back to that URL waits for the write before.
    const [inspectorTrack, setInspectorTrack] = useState<{ location: typeof location; entry: number; foreign: number; write: InspectorWrite | null }>(
        { location, entry: browserEntry.entry, foreign: 0, write: null }
    );
    let track = inspectorTrack;
    if (track.location !== location || track.entry !== browserEntry.entry) {
        const own =
            track.write !== null &&
            track.entry === browserEntry.entry &&
            navigationType === NavigationType.Replace &&
            inspectorWriteOf(location.state) === track.write.id;
        track = { location, entry: browserEntry.entry, foreign: own ? track.foreign : track.foreign + 1, write: null };
    }
    const choice = inspectorChoice?.foreign === track.foreign ? inspectorChoice : null;
    if (choice && !track.write) {
        const search = inspectorQuery(location.search, choice.extension);
        if (search !== location.search) track = { ...track, write: { id: choice.id, pathname: location.pathname, search } };
    }
    if (track !== inspectorTrack) setInspectorTrack(track);
    const linkedExtension = choice ? choice.extension : inspectorExtension(new URLSearchParams(location.search));
    // The inspector renders once, into this node. The side panel or the dialog holds the node, so the inspector keeps its
    // views and the state of its slots when the screen crosses the breakpoint.
    const [inspectorNode] = useState(() => {
        const node = document.createElement('div');
        node.style.display = 'contents';
        return node;
    });
    // Each move ends the modal state of an open dialog in a slot. StrictMode attaches the ref of a new host twice.
    const placeInspector = useCallback((place: HTMLDivElement | null) => {
        if (place && inspectorNode.parentNode !== place) place.appendChild(inspectorNode);
    }, [inspectorNode]);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [focusInspector, setFocusInspector] = useState(false);
    const clearFocusInspector = useCallback(() => setFocusInspector(false), []);
    const inspectorOpen = !!isDiagramView && (linkedExtension !== null || detailsOpen);
    const inspectorTab: InspectorTab = linkedExtension !== null ? 'extensions' : 'details';
    // The tab and the extension shown last, by a link or by the user, so the inspector opens again on them.
    const [lastInspector, setLastInspector] = useState<{ tab: InspectorTab; extension: string }>({ tab: 'details', extension: '' });
    if (inspectorOpen && (lastInspector.tab !== inspectorTab || (linkedExtension !== null && linkedExtension !== lastInspector.extension))) {
        setLastInspector({ tab: inspectorTab, extension: linkedExtension ?? lastInspector.extension });
    }
    // On a wide screen a selection opens the inspector, as the node details did, also a click on the item that is
    // already selected after the inspector closed, and a link or a browser move whose URL names it, also to the URL that
    // shows. A replace that changes the URL, such as closing the inspector, is not a link. A narrow screen shows the sheet.
    const linkKey = useLinkKey(browserEntry.entry);
    const [openedFor, setOpenedFor] = useState({ id: selectedId, selections, linkKey });
    if (openedFor.id !== selectedId || openedFor.selections !== selections || openedFor.linkKey !== linkKey) {
        const opens = openedFor.id !== selectedId || openedFor.selections !== selections || selectedId === linkedNodeId;
        setOpenedFor({ id: selectedId, selections, linkKey });
        if (opens && selectedId !== undefined && !isMobile) setDetailsOpen(true);
    }

    const foreignNavigations = inspectorTrack.foreign;
    const setInspectorExtension = useCallback(
        (extension: string | null) => setInspectorChoice({ extension, id: newWriteId(), foreign: foreignNavigations }),
        [foreignNavigations]
    );
    // Each write goes to the router once, with the fields of the history state of the page.
    const inspectorWrite = inspectorTrack.write;
    const sentWrite = useRef<InspectorWrite | null>(null);
    useLayoutEffect(() => {
        if (!inspectorWrite || inspectorWrite === sentWrite.current) return;
        sentWrite.current = inspectorWrite;
        const { hash, state } = locationRef.current;
        navigate(
            { pathname: inspectorWrite.pathname, search: inspectorWrite.search, hash },
            { replace: true, state: withInspectorWrite(state, inspectorWrite.id) }
        );
    }, [inspectorWrite, navigate]);

    // The choice and the write of the last render, for handleItemSelect, which must not change with them.
    const shownInspector = useRef({ choice, track: inspectorTrack });
    useLayoutEffect(() => {
        shownInspector.current = { choice, track: inspectorTrack };
    });

    // When the user selects another item or closes the panel, the URL stops naming the linked node, so a
    // copied link or a reload does not open it again. That replace is one of Hub's writes. It keeps the inspector's
    // latest choice, and it takes the place and the id of a write that the router has not shown yet.
    const handleItemSelect = useCallback((item: SelectedItem) => {
        setSelectedItem(item);
        if (item) setSelections((count) => count + 1);
        const { pathname, search } = locationRef.current;
        const params = new URLSearchParams(search);
        const linked = params.get('node');
        if (!linked || item?.data['unique-id'] === linked) return;
        params.delete('node');
        const query = params.toString();
        const { choice, track } = shownInspector.current;
        const nextSearch = choice ? inspectorQuery(query, choice.extension) : query ? `?${query}` : '';
        setNodeRemovedFromUrl(nextSearch);
        setInspectorTrack({ ...track, write: { id: track.write?.id ?? newWriteId(), pathname, search: nextSearch } });
    }, []);

    const closeSidebar = useCallback(() => handleItemSelect(null), [handleItemSelect]);
    const selectInspectorTab = useCallback(
        (tab: InspectorTab, extension = '') => {
            setDetailsOpen(tab === 'details');
            setInspectorExtension(tab === 'extensions' ? extension : null);
        },
        [setInspectorExtension]
    );
    // Focus goes back to the control that opened the inspector, or else to its handle.
    const inspectorOpener = useRef<HTMLElement | null>(null);
    const returnFocus = useRef(false);
    useEffect(() => {
        if (inspectorOpen || !returnFocus.current) return;
        returnFocus.current = false;
        const opener = inspectorOpener.current?.isConnected ? inspectorOpener.current : null;
        (opener ?? document.querySelector<HTMLElement>(`[aria-controls="${INSPECTOR_ID}"]`))?.focus();
    }, [inspectorOpen]);
    const openInspector = () => {
        inspectorOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setFocusInspector(true);
        selectInspectorTab(lastInspector.tab, lastInspector.extension);
    };
    const closeInspector = () => {
        returnFocus.current = true;
        setDetailsOpen(false);
        setInspectorExtension(null);
    };
    const toggleInspector = () => (inspectorOpen ? closeInspector() : openInspector());

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
    // A node of a dropped file is not the resource's.
    const resourceSelection = showsDroppedFile ? undefined : selectedId;
    if (resourceSelection) returnQuery.set('node', resourceSelection);
    // Only once the resource has loaded: until then the entry keeps the selection that the load opens again. A node that
    // the URL names opens from the URL. After a browser move, only the render that opens the selection of the new entry
    // keeps one for it. `hasMoved` changes on each move.
    const { hasMoved } = browserEntry;
    useEffect(() => {
        if (!data || !isDiagramView || hasMoved()) return;
        writeEntrySelection(selectionStorage, location, resourceSelection === linkedNodeId ? undefined : resourceSelection);
    }, [selectionStorage, location, hasMoved, data, isDiagramView, resourceSelection, linkedNodeId]);
    const returnSearch = returnQuery.toString() ? `?${returnQuery.toString()}` : '';
    const returnLabel = detailMatch
        ? `${displayName || detailMatch.params.id} ${detailMatch.params.version}`
        : 'search results';

    // The parts of a link that this page cannot show. The page itself shows; access is checked when each part loads.
    const linkNotices: string[] = [];
    if (data && !showsDroppedFile && isDetailRoute) {
        if (linkedNodeId && isDiagramView && !findElement(data, linkedNodeId)) {
            const kind = data.calmType === 'Patterns' ? 'pattern' : 'architecture';
            linkNotices.push(`The element "${linkedNodeId}" is not in version ${data.version} of this ${kind}.`);
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

    const inspector = data && isDiagramView && (
        <DiagramInspector
            data={data}
            displayName={displayName}
            selected={selectedItem?.data}
            context={inspectorContext}
            open={inspectorOpen}
            tab={inspectorTab}
            extensionId={linkedExtension ?? (lastInspector.extension || undefined)}
            focusOnOpen={focusInspector}
            onFocused={clearFocusInspector}
            onSelectTab={selectInspectorTab}
            onClose={isMobile ? undefined : closeInspector}
            onClearSelection={closeSidebar}
        />
    );

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
            hasDetailsPanel={isMobile ? !!selectedItem : inspectorOpen}
            selectedElement={selectedId}
            inspector={{ open: inspectorOpen, controls: INSPECTOR_ID, onToggle: toggleInspector }}
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
        <ControlPanel
            key={`${controlData.controlId}|${controlData.path ?? ''}|${controlData.variant ?? ''}`}
            controlData={controlData}
        />
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
        <DecoratorsContext.Provider value={decoratorsState}>
        <ReturnPointProvider page={returnPage} label={returnLabel} search={returnSearch}>
        <ExtensionResourceContext.Provider value={inspectorContext}>
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

                {inspector &&
                    (isMobile ? (
                        <>
                            {/* Mobile: bottom-sheet that keeps the diagram peeking above (Frame G). It hides while
                                the full-screen inspector is open, and keeps its place, so focus can go back to it. */}
                            {selectedItem && (
                                <div hidden={inspectorOpen}>
                                    <NodeSheet
                                        selectedData={selectedItem.data}
                                        closeSheet={closeSidebar}
                                        onPrev={onPrevNode}
                                        onNext={onNextNode}
                                        onOpenInspector={openInspector}
                                    />
                                </div>
                            )}
                            <MobileInspector open={inspectorOpen} onClose={closeInspector}>
                                <div ref={placeInspector} className="contents" />
                            </MobileInspector>
                        </>
                    ) : (
                        <Sidebar id={INSPECTOR_ID} label="Inspector" hidden={!inspectorOpen}>
                            <div ref={placeInspector} className="contents" />
                        </Sidebar>
                    ))}
                {/* After the panel or the dialog above, so a confirmation in a slot shows modally again on top of it. */}
                {inspector && (
                    <SlotHostContext.Provider value={isMobile ? 'dialog' : 'side panel'}>
                        {createPortal(inspector, inspectorNode)}
                    </SlotHostContext.Provider>
                )}

            </div>
        </AppLayout>
        </ExtensionResourceContext.Provider>
        </ReturnPointProvider>
        </DecoratorsContext.Provider>
        </DiagramActionsContext.Provider>
    );
}
