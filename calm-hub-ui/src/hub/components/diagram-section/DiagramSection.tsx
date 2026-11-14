import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { IoChevronBackOutline, IoConstructOutline, IoGridOutline, IoTimeOutline, IoCloseOutline, IoCheckmarkOutline } from 'react-icons/io5';
import { useIsMobile } from '../../../hooks/useMediaQuery.js';
import { useExtensions, useExtensionsStatus } from '../../../extensions/ExtensionsContext.js';
import { ExtensionPoints } from '../../../extensions/ExtensionPoints.js';
import { EXTENSION_TAB_PREFIX, extensionTabs } from '../../../extensions/extension-tabs.js';
import { BreadcrumbItem, Data } from '../../../model/calm.js';
import { sortVersionsDescending } from '../../../model/version.js';
import { Drawer } from '../../../visualizer/components/drawer/Drawer.js';
import { SectionHeader } from '../section-header/SectionHeader.js';
import { SearchBar } from '../../../visualizer/components/reactflow/SearchBar.js';
import { NodeSearchProvider, type NodeSearchState } from '../../../visualizer/components/reactflow/node-search-context.js';
import { CompareView } from './compare/CompareView.js';
import { diffArchitectures, diffPatterns, type NodesAndRelationshipsDiffResult } from '@finos/calm-models/diff';
import type { CalmArchitectureSchema, CalmTimelineSchema } from '@finos/calm-models/types';
import type { DiffSource } from '../../../diff/model/diff-ui-types.js';
import { TimelineBar, type TimelineMoment } from './timeline/TimelineBar.js';
import { MobileTimeline } from './timeline/MobileTimeline.js';
import {
    currentMomentIdFromTimeline,
    isExplicitTimeline,
    momentsFromTimeline,
    momentsFromVersions,
} from './timeline/timelineMoments.js';
import { computeChanges, type VersionChange } from './timeline/perVersionChanges.js';
import { fetchVersionData, fetchVersionList } from './compare/compareData.js';
import { CalmService } from '../../../service/calm-service.js';
import { colors } from '../../../theme/colors.js';
import type { Decorator, DecoratorView, SelectedItem } from '../../../visualizer/contracts/contracts.js';
import { useDefaultLayout } from '../../hooks/useDefaultLayout.js';
import { loadStoredNodePositions, type StoredNodePosition } from '../../../visualizer/services/node-position-service.js';
import { useUserAccess } from '../../../admin/context/UserAccessContext.js';
import { IoSaveOutline, IoRefreshOutline } from 'react-icons/io5';
import { PatternImplementationService } from '../../../service/pattern-implementation-service.js';
import { usePatternImplementations } from './used-by/usePatternImplementations.js';
import { useArchitectureDecorators } from './decorators/useArchitectureDecorators.js';
import { DECORATORS_TAB_ID, decoratorFilterParams, DIAGRAM_TAB_REDIRECTS, DIAGRAM_TABS, extensionContext } from './tabs/diagramTabs.js';
import {
    DEFAULT_DIAGRAM_TAB_ID,
    diagramTabLabel,
    diagramTabQuery,
    redirectedTabQuery,
    resolveDiagramTab,
    visibleDiagramTabs,
    type DiagramTab,
    type DiagramTabContext,
} from './tabs/diagramTabRegistry.js';

interface DiagramSectionProps {
    data: Data & { calmType: 'Architectures' | 'Patterns' };
    onItemSelect?: (item: SelectedItem) => void;
    hasDetailsPanel?: boolean;
    selectedElement?: string;
    breadcrumbs?: BreadcrumbItem[];
    /**
     * Mirrors the resolved display name up to Hub, which snapshots it into the
     * breadcrumb pushed on detailed-architecture navigation. Must be
     * identity-stable (memoised by the caller): it is listed in the deps of the
     * fetch effect that reports it.
     */
    onDisplayNameChange?: (name: string | undefined) => void;
    /**
     * Reports every decorator of the version on screen, so the details drawer can list those of the selected element.
     * Called with an empty list on unmount. Must be identity-stable.
     */
    onDecoratorsChange?: (decorators: Decorator[]) => void;
    onDroppedFileChange?: (dropped: boolean) => void;
}

const iconMap = {
    Architectures: IoConstructOutline,
    Patterns: IoGridOutline,
} as const;

const NO_DECORATORS: Decorator[] = [];
const DECORATOR_TAB_IDS: ReadonlySet<string> = new Set([DEFAULT_DIAGRAM_TAB_ID, DECORATORS_TAB_ID]);
const NO_MOMENTS: TimelineMoment[] = [];

const subscribeToNothing = () => () => {};
const getNavbarSlot = () => document.getElementById('navbar-actions');
const getNoNavbarSlot = () => null;

export function DiagramSection({ data, onItemSelect, hasDetailsPanel, breadcrumbs, onDisplayNameChange, onDecoratorsChange, onDroppedFileChange, selectedElement }: DiagramSectionProps) {
    const [urlSearchParams, setSearchParams] = useSearchParams();
    // An old tab link opens its replacement at once; the effect below then fixes the URL.
    const redirectedQuery = redirectedTabQuery(DIAGRAM_TAB_REDIRECTS, urlSearchParams);
    const searchParams = redirectedQuery ?? urlSearchParams;
    const navigate = useNavigate();
    const location = useLocation();
    const isMobile = useIsMobile();
    const [showTimeline, setShowTimeline] = useState(false);
    const [showViewMenu, setShowViewMenu] = useState(false);
    // The view-options menu trigger lives in the navbar (top nav), not floating
    // over the canvas. useSyncExternalStore reads the slot again after mount, so a
    // navbar that mounts in the same commit is still found.
    const navbarSlot = useSyncExternalStore(subscribeToNothing, getNavbarSlot, getNoNavbarSlot);
    // Node ("component") search state, surfaced inside the mobile view menu and
    // applied to the graph via NodeSearchProvider.
    const [nodeSearchTerm, setNodeSearchTerm] = useState('');
    const [nodeTypeFilter, setNodeTypeFilter] = useState('');
    const [nodeTypes, setNodeTypes] = useState<string[]>([]);
    const nodeSearch = useMemo<NodeSearchState>(
        () => ({
            searchTerm: nodeSearchTerm,
            setSearchTerm: setNodeSearchTerm,
            typeFilter: nodeTypeFilter,
            setTypeFilter: setNodeTypeFilter,
            availableNodeTypes: nodeTypes,
            setAvailableNodeTypes: setNodeTypes,
            external: true,
        }),
        [nodeSearchTerm, nodeTypeFilter, nodeTypes]
    );
    const calmService = useMemo(() => new CalmService(), []);
    const defaultLayoutState = useDefaultLayout(data.name, data.id, data.calmType, data.data as Record<string, unknown> | undefined);
    // Destructured locals so handleSaveLayout/handleResetLayout below can depend
    // on exactly the (already useCallback-stable) functions they call, rather
    // than the whole result object — which still changes identity whenever
    // `saving` flips mid-save, even though the memoised object in useDefaultLayout
    // stops it changing for unrelated reasons.
    const { save: saveDefaultLayout, reset: resetDefaultLayout } = defaultLayoutState;
    // Latest on-screen positions, reported by the graph after every apply and at
    // drag-end. Held in a ref (not state) so "Save as default layout" can read
    // it without the graph re-rendering on every drag.
    const latestPositionsRef = useRef<StoredNodePosition[] | null>(null);
    // Whether the current diagram has an unsaved local drag to reset away from.
    const [hasScratchLayout, setHasScratchLayout] = useState(false);
    // Also re-derived when viewportKey/layoutEpoch change (navigating to a new
    // diagram, or a save/reset bump) so the button reflects reality immediately
    // rather than waiting on the graph's own apply to report back through
    // handlePositionsChange below.
    const scratchCheckKey = `${defaultLayoutState.viewportKey}|${defaultLayoutState.layoutEpoch}`;
    const [scratchCheckedFor, setScratchCheckedFor] = useState<string | null>(null);
    if (scratchCheckedFor !== scratchCheckKey) {
        setScratchCheckedFor(scratchCheckKey);
        const key = defaultLayoutState.viewportKey;
        setHasScratchLayout(!!key && !!loadStoredNodePositions(key));
    }
    const handlePositionsChange = useCallback(
        (positions: StoredNodePosition[]) => {
            latestPositionsRef.current = positions;
            // Reported on every apply (initial parse-apply AND drag-end), not
            // just drag-end, so a report alone doesn't mean scratch content
            // changed. Re-check localStorage directly (the source of truth,
            // and cheap) rather than assuming — this keeps the Reset button's
            // enabled state accurate after a drag, instead of only refreshing
            // it when viewportKey/layoutEpoch change (see above).
            const key = defaultLayoutState.viewportKey;
            setHasScratchLayout(!!key && !!loadStoredNodePositions(key));
        },
        [defaultLayoutState.viewportKey]
    );
    const isArchitecture = data.calmType === 'Architectures';
    const resourceKey = `${data.calmType}|${data.name}|${data.id}`;
    // A dropped file is not the loaded architecture, so the details drawer must not show its decorators.
    const [showsDroppedFile, setShowsDroppedFile] = useState(false);
    useEffect(() => { onDroppedFileChange?.(showsDroppedFile); }, [onDroppedFileChange, showsDroppedFile]);
    useEffect(() => () => onDroppedFileChange?.(false), [onDroppedFileChange]);
    const [compareFrom, setCompareFrom] = useState<string | null>(null);
    const [compareTo, setCompareTo] = useState<string | null>(null);
    const comparing = compareFrom !== null && compareTo !== null;
    const [versions, setVersions] = useState<string[]>([]);
    // Fetched results are kept with the key they were fetched for, so a result for
    // another resource, version or comparison is never shown.
    // `doc` is null when the timeline could not be loaded.
    const [loadedTimeline, setLoadedTimeline] = useState<{ key: string; doc: CalmTimelineSchema | null } | null>(null);
    const timelineResult = isArchitecture && loadedTimeline?.key === resourceKey ? loadedTimeline : null;
    const timelineDoc = timelineResult?.doc ?? null;
    const timelineMoments = useMemo(() => (timelineDoc ? momentsFromTimeline(timelineDoc) : null), [timelineDoc]);
    const versionMoments = useMemo(() => momentsFromVersions(versions), [versions]);
    // Architectures use the (explicit or implied) timeline document, and fall back to
    // the version list so the bar still navigates. Patterns build moments straight from
    // the version list (reversed to chronological, oldest-first) order.
    const moments: TimelineMoment[] = !isArchitecture
        ? versionMoments
        : timelineResult === null
          ? NO_MOMENTS
          : (timelineMoments ?? versionMoments);
    /**
     * The timeline document's `current-moment` field — used for the NOW badge.
     * Undefined when there is no timeline doc (patterns) or when the projection
     * is implied and so the "current" moment isn't a real authored point.
     */
    const timelineCurrentMomentId = timelineDoc ? currentMomentIdFromTimeline(timelineDoc) : undefined;
    /** True for stored / authored (explicit) timelines, false for implied projections. */
    const timelineIsExplicit = timelineDoc ? isExplicitTimeline(timelineDoc) : false;
    const [loadedSummary, setLoadedSummary] = useState<{
        key: string;
        displayName: string | undefined;
        patternName: string | undefined;
    } | null>(null);
    const summary = loadedSummary?.key === resourceKey ? loadedSummary : null;
    const displayName = summary?.displayName;
    // The pattern's name on the name-based API, which the implementations lookup needs.
    const patternName = summary?.patternName;
    /** Compare-mode data shared by CompareView (graphs) and TimelineBar (summary). */
    const compareKey = `${resourceKey}|${compareFrom}|${compareTo}`;
    const [loadedComparison, setLoadedComparison] = useState<{
        key: string;
        sourceA: DiffSource | null;
        sourceB: DiffSource | null;
        diffResult: NodesAndRelationshipsDiffResult | null;
        error: string | null;
    } | null>(null);
    const comparison = comparing && loadedComparison?.key === compareKey ? loadedComparison : null;
    const compareSourceA = comparison?.sourceA ?? null;
    const compareSourceB = comparison?.sourceB ?? null;
    const diffResult = comparison?.diffResult ?? null;
    const compareError = comparison?.error ?? null;

    const urlType = isArchitecture ? 'architectures' : 'patterns';
    const typeLabel = isArchitecture ? 'Architecture' : 'Pattern';

    const implementationService = useMemo(() => new PatternImplementationService(), []);
    const extensions = useExtensions();
    const registeredTabs = [...DIAGRAM_TABS, ...extensionTabs(extensions)];
    const tabScope = { isArchitecture, patternName };
    const visibleTabs = visibleDiagramTabs(registeredTabs, tabScope);
    const activeTab = resolveDiagramTab(registeredTabs, searchParams.get('tab'), tabScope);
    const tabQuery = diagramTabQuery(activeTab, searchParams);
    const usedByOpen = activeTab.id === 'used-by' && !comparing;
    const usedBy = usePatternImplementations(implementationService, data.name, patternName, data.version, usedByOpen);
    // Polled only while the diagram, the Decorators tab or the details drawer shows them.
    const showsDecorators = (!comparing && DECORATOR_TAB_IDS.has(activeTab.id)) || !!hasDetailsPanel;
    const decoratorsState = useArchitectureDecorators(calmService, data, isArchitecture, showsDecorators);
    const allDecorators = decoratorsState.status === 'loaded' ? decoratorsState.decorators : NO_DECORATORS;

    // "View all" opens the Decorators tab and unmounts itself, so the tab takes focus.
    // The panel reads it on mount only, and clears it once it took focus, so a later visit does not take focus.
    const [focusPanel, setFocusPanel] = useState(false);
    const clearFocusPanel = useCallback(() => setFocusPanel(false), []);
    const setActiveTab = (tab: DiagramTab) => {
        setFocusPanel(false);
        setSearchParams({ tab: tab.id }, { replace: true, state: location.state });
    };
    const setTabParams = (params: Record<string, string>) => {
        setSearchParams({ tab: activeTab.id, ...params }, { replace: true, state: location.state });
    };
    const redirectTo = redirectedQuery?.toString();
    useEffect(() => {
        if (redirectTo !== undefined) setSearchParams(new URLSearchParams(redirectTo), { replace: true, state: location.state });
    }, [redirectTo, setSearchParams, location.state]);
    const openDecoratorView = useCallback((view: DecoratorView) => {
        setFocusPanel(true);
        setSearchParams(
            { tab: DECORATORS_TAB_ID, ...decoratorFilterParams(view.match.type, view.match.schema) },
            { replace: true, state: location.state }
        );
    }, [setSearchParams, location.state]);

    // A tab id no entry registers is dropped from the URL, so a copied link does not keep it. A hidden tab such as
    // used-by is kept, because it can become visible when the pattern summary loads. An extension tab is kept until
    // the registry loads, because only then is it registered.
    const requestedTab = searchParams.get('tab');
    const registryLoaded = useExtensionsStatus() === 'loaded';
    const unknownTab = requestedTab !== null
        && !registeredTabs.some((tab) => tab.id === requestedTab)
        && (registryLoaded || !requestedTab.startsWith(EXTENSION_TAB_PREFIX));
    useEffect(() => {
        if (!unknownTab) return;
        setSearchParams(
            (current) => {
                const next = new URLSearchParams(current);
                next.delete('tab');
                return next;
            },
            { replace: true, state: location.state }
        );
    }, [unknownTab, setSearchParams, location.state]);

    // Save/reset the shared default layout — supported for both architectures
    // and patterns (backed by separate resources/collections server-side, see
    // PatternLayoutStore's class javadoc). Cosmetic gating only — see
    // canWriteNamespace's own comment; @PermissionsAllowed(WRITE) on the
    // backend resource is the real gate.
    const { canWriteNamespace } = useUserAccess();
    const canSaveLayout = defaultLayoutState.canSave && canWriteNamespace(data.name);

    const handleSaveLayout = useCallback(() => {
        const positions = latestPositionsRef.current;
        if (!positions) return;
        // Errors surface via defaultLayoutState.saveError, rendered as an inline
        // alert below.
        saveDefaultLayout(positions).catch(() => {});
    }, [saveDefaultLayout]);

    const handleResetLayout = useCallback(() => {
        resetDefaultLayout();
    }, [resetDefaultLayout]);

    const handleVersionChange = (version: string) => {
        // Selecting any moment exits compare mode, even if it's the
        // already-current version (otherwise compare would be a trap when one
        // of the endpoints is the version you started from).
        setCompareFrom(null);
        setCompareTo(null);
        if (version === data.version) return;
        // Preserve the active tab and breadcrumb state when switching version.
        navigate(`/${data.name}/${urlType}/${data.id}/${version}${tabQuery}`, {
            state: { ...(location.state as object | null), timelineSelection: true },
        });
    };

    const handleBreadcrumbClick = useCallback((crumb: BreadcrumbItem, index: number) => {
        navigate(`/${crumb.namespace}/${crumb.type}/${crumb.id}/${crumb.version}`, {
            state: { breadcrumbs: (breadcrumbs || []).slice(0, index) }
        });
    }, [navigate, breadcrumbs]);

    const startCompare = (from: string, to: string) => {
        setCompareFrom(from);
        setCompareTo(to);
    };

    // Fetch both compared versions and compute the diff at the section level so
    // both the CompareView (graphs) and the TimelineBar (inline diff summary)
    // share the same result.
    useEffect(() => {
        if (!compareFrom || !compareTo) return;
        let cancelled = false;
        Promise.all([
            fetchVersionData(calmService, data.name, data.calmType, data.id, compareFrom),
            fetchVersionData(calmService, data.name, data.calmType, data.id, compareTo),
        ])
            .then(([a, b]) => {
                if (cancelled) return;
                const aData = (a.data ?? null) as DiffSource | null;
                const bData = (b.data ?? null) as DiffSource | null;
                setLoadedComparison({
                    key: compareKey,
                    sourceA: aData,
                    sourceB: bData,
                    diffResult:
                        aData && bData
                            ? data.calmType === 'Patterns'
                                ? diffPatterns(aData, bData)
                                : diffArchitectures(
                                      aData as CalmArchitectureSchema,
                                      bData as CalmArchitectureSchema
                                  )
                            : null,
                    error: null,
                });
            })
            .catch(() => {
                if (!cancelled) {
                    setLoadedComparison({
                        key: compareKey,
                        sourceA: null,
                        sourceB: null,
                        diffResult: null,
                        error: 'Failed to load versions to compare',
                    });
                }
            });
        return () => {
            cancelled = true;
        };
    }, [calmService, data.name, data.calmType, data.id, compareFrom, compareTo, compareKey]);

    /** Diff the selected and previous version of this resource for the WHAT CHANGED block. */
    const loadChangesForVersion = useCallback(
        async (prevVersion: string, currVersion: string): Promise<VersionChange[]> => {
            const [prev, curr] = await Promise.all([
                fetchVersionData(calmService, data.name, data.calmType, data.id, prevVersion),
                fetchVersionData(calmService, data.name, data.calmType, data.id, currVersion),
            ]);
            return computeChanges(data.calmType, prev.data, curr.data);
        },
        [calmService, data.name, data.calmType, data.id]
    );

    // Reset compare state when the underlying resource changes.
    const [compareResourceKey, setCompareResourceKey] = useState(resourceKey);
    if (compareResourceKey !== resourceKey) {
        setCompareResourceKey(resourceKey);
        setCompareFrom(null);
        setCompareTo(null);
    }

    // Resolve the resource's human-readable name for the breadcrumb (the route
    // carries only the id, which is often numeric).
    useEffect(() => {
        let cancelled = false;
        const summaries = isArchitecture
            ? calmService.fetchArchitectureSummaries(data.name)
            : calmService.fetchPatternSummaries(data.name);
        summaries
            .then((list) => {
                if (cancelled) return;
                const match = list.find((s) => String(s.id) === data.id || s.customId === data.id);
                setLoadedSummary({
                    key: resourceKey,
                    displayName: match?.name,
                    patternName: isArchitecture ? undefined : match?.customId,
                });
                onDisplayNameChange?.(match?.name);
            })
            .catch(() => {
                if (!cancelled) {
                    setLoadedSummary({ key: resourceKey, displayName: undefined, patternName: undefined });
                    onDisplayNameChange?.(undefined);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [calmService, data.name, data.id, isArchitecture, onDisplayNameChange, resourceKey]);

    useEffect(() => {
        let cancelled = false;
        fetchVersionList(calmService, data.name, data.calmType, data.id)
            .then((list) => {
                if (!cancelled) setVersions(sortVersionsDescending(list));
            })
            .catch(() => {
                if (!cancelled) setVersions([]);
            });
        return () => {
            cancelled = true;
        };
    }, [calmService, data.name, data.calmType, data.id]);

    useEffect(() => {
        if (!isArchitecture) return;
        let cancelled = false;
        calmService
            .fetchArchitectureTimeline(data.name, data.id)
            .catch((): null => null)
            .then((doc) => {
                if (!cancelled) setLoadedTimeline({ key: resourceKey, doc });
            });
        return () => {
            cancelled = true;
        };
    }, [isArchitecture, calmService, data.name, data.id, resourceKey]);

    const drawerDecorators = showsDroppedFile ? NO_DECORATORS : allDecorators;
    useEffect(() => {
        onDecoratorsChange?.(drawerDecorators);
    }, [drawerDecorators, onDecoratorsChange]);
    useEffect(() => () => onDecoratorsChange?.(NO_DECORATORS), [onDecoratorsChange]);

    // When an architecture has an explicit timeline, landing on the latest
    // version (the tree's implicit default) one-shot redirects to the
    // timeline's current-moment instead — once per resource visit, so the
    // user can still navigate freely to other versions afterwards.
    // Hub remounts DiagramSection on every version change, which resets the
    // ref, so a timeline selection is also marked in navigation state.
    const explicitRedirectedFor = useRef<string | null>(null);
    useEffect(() => {
        explicitRedirectedFor.current = null;
    }, [data.name, data.id]);
    useEffect(() => {
        if (!isArchitecture) return;
        if ((location.state as { timelineSelection?: boolean } | null)?.timelineSelection) return;
        if (!timelineIsExplicit || !timelineCurrentMomentId) return;
        if (versions.length === 0 || moments.length === 0) return;
        const resourceKey = `${data.name}/${data.id}`;
        if (explicitRedirectedFor.current === resourceKey) return;
        explicitRedirectedFor.current = resourceKey;

        const currentMoment = moments.find((m) => m.key === timelineCurrentMomentId);
        if (!currentMoment || currentMoment.version === data.version) return;
        // Only redirect when the user is on the latest version — anything else
        // is a deliberate pick (deep-link or manual navigation) we shouldn't override.
        if (data.version !== versions[0]) return;

        navigate(
            `/${data.name}/${urlType}/${data.id}/${currentMoment.version}${tabQuery}`,
            { replace: true, state: location.state }
        );
    }, [
        isArchitecture,
        timelineIsExplicit,
        timelineCurrentMomentId,
        moments,
        versions,
        data.name,
        data.id,
        data.version,
        urlType,
        tabQuery,
        navigate,
        location.state,
    ]);

    const Icon = iconMap[data.calmType];
    const extensionActions = !showsDroppedFile && (
        <ExtensionPoints point="action" context={extensionContext(data, selectedElement)} placement="diagram-toolbar" />
    );

    const tabContext: DiagramTabContext = {
        ...tabScope,
        data,
        selectedElement,
        searchParams,
        setTabParams,
        diagram: (
            <Drawer
                data={data}
                onItemSelect={onItemSelect}
                viewportKeyOverride={defaultLayoutState.viewportKey}
                defaultLayout={defaultLayoutState.defaultLayout}
                layoutEpoch={defaultLayoutState.layoutEpoch}
                onPositionsChange={handlePositionsChange}
                onDroppedFileChange={setShowsDroppedFile}
                decorators={allDecorators}
                onOpenView={openDecoratorView}
            />
        ),
        decorators: decoratorsState,
        usedBy,
        focusPanel,
        onPanelFocused: clearFocusPanel,
    };

    // Desktop: inline tabs in the section header (unchanged).
    const tabs = (
        <div role="tablist" className="tabs tabs-boxed tabs-sm bg-base-100">
            {visibleTabs.map((tab) => {
                const label = diagramTabLabel(tab, tabContext);
                const TabIcon = tab.icon;
                return (
                    <button
                        key={tab.id}
                        role="tab"
                        aria-label={label}
                        title={tab.title}
                        className={`tab gap-1 rounded-lg ${!comparing && activeTab === tab ? 'tab-active !bg-[var(--color-interaction)] !text-white' : ''}`}
                        onClick={() => setActiveTab(tab)}
                    >
                        <TabIcon />
                        <span className="hidden sm:inline">{label}</span>
                    </button>
                );
            })}
        </div>
    );

    // Desktop entry point for the shared default layout (mobile's lives in the
    // view-options menu below). Only meaningful on the diagram tab, and never
    // while comparing versions. Not gated on isArchitecture — layout save is
    // supported for both architectures and patterns.
    const showLayoutActions = !comparing && activeTab.id === DEFAULT_DIAGRAM_TAB_ID;
    const layoutActions = showLayoutActions && (
        <div className="flex items-center gap-1">
            {defaultLayoutState.hasBothSources && (
                <div className="join" role="group" aria-label="Layout source">
                    <button
                        type="button"
                        className={`join-item btn btn-xs ${defaultLayoutState.layoutSource === 'document' || (defaultLayoutState.layoutSource === 'auto' && defaultLayoutState.documentLayout) ? 'btn-active' : ''}`}
                        onClick={() => defaultLayoutState.setLayoutSource('document')}
                        title="Use layout from document"
                    >
                        Document
                    </button>
                    <button
                        type="button"
                        className={`join-item btn btn-xs ${defaultLayoutState.layoutSource === 'server' || (defaultLayoutState.layoutSource === 'auto' && !defaultLayoutState.documentLayout) ? 'btn-active' : ''}`}
                        onClick={() => defaultLayoutState.setLayoutSource('server')}
                        title="Use saved layout from server"
                    >
                        Saved
                    </button>
                </div>
            )}
            {canSaveLayout && (
                <button
                    type="button"
                    aria-label="Save as default layout"
                    title="Save as default layout"
                    className="btn btn-ghost btn-sm btn-circle"
                    disabled={defaultLayoutState.saving}
                    onClick={handleSaveLayout}
                >
                    <IoSaveOutline size={16} />
                </button>
            )}
            <button
                type="button"
                aria-label="Reset to default layout"
                title="Reset to default layout"
                className="btn btn-ghost btn-sm btn-circle"
                disabled={!hasScratchLayout}
                onClick={handleResetLayout}
            >
                <IoRefreshOutline size={16} />
            </button>
        </div>
    );

    // Shared error banner for a failed save, rendered in the main pane on both
    // desktop and mobile — not in the mobile view-options menu, which the two
    // handlers below close before the async save settles, so an error rendered
    // there would never be seen. Mirrors Drawer's dropError banner; there is no
    // toast/notification system in this app.
    const layoutSaveError = showLayoutActions && defaultLayoutState.saveError && (
        <div
            role="alert"
            className="shrink-0 mx-3 mt-2 px-3 py-2 rounded-md text-[12px]"
            style={{
                color: colors.status.error,
                border: `1px solid ${colors.status.error}`,
                backgroundColor: colors.redesign.surface,
            }}
        >
            {defaultLayoutState.saveError}
        </div>
    );

    // Mobile: full-bleed render pane; the view-options menu lives in the navbar
    // and opens as a full-screen overlay styled like the explorer. The trigger
    // shows the active view icon.
    const breadcrumb = (
        <h2 className="px-4 py-3 text-sm font-medium flex flex-wrap items-center gap-x-1 border-b border-base-200 text-base-content">
            <Icon className="text-[var(--color-interaction)] shrink-0" />
            {data.name}
            {typeLabel && (
                <>
                    <span className="text-base-content/40">/</span> <span className="text-base-content/70">{typeLabel}</span>
                </>
            )}
            <span className="text-base-content/40">/</span>
            <span title={data.id} className="break-all">
                {displayName || data.id}
            </span>
        </h2>
    );

    const viewModeRow = (tab: DiagramTab, onSelect?: () => void) => {
        const active = !comparing && activeTab === tab;
        const label = diagramTabLabel(tab, tabContext);
        const TabIcon = tab.icon;
        return (
            <button
                key={tab.id}
                role="tab"
                aria-label={label}
                aria-selected={active}
                onClick={() => {
                    setActiveTab(tab);
                    onSelect?.();
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-base-200 active:bg-base-200 ${
                    active ? 'bg-base-200 text-[var(--color-interaction)] font-semibold' : 'text-base-content'
                }`}
            >
                <span className={active ? 'text-[var(--color-interaction)]' : 'text-base-content/60'}>
                    <TabIcon size={18} />
                </span>
                <span className="flex-1 min-w-0 truncate">{label}</span>
                {active && <IoCheckmarkOutline size={18} className="text-[var(--color-interaction)] shrink-0" />}
            </button>
        );
    };

    const renderViewModes = (onSelect?: () => void) => (
        <div role="tablist" className="divide-y divide-base-200 border-b border-base-200">
            {visibleTabs.map((tab) => viewModeRow(tab, onSelect))}
        </div>
    );

    const ActiveViewIcon = activeTab.icon;
    const activeViewIcon = <ActiveViewIcon size={20} />;

    const viewMenu = (
        <>
            {/* Labelled "◉ View" pill (redesign problem #11): replaces the bare,
                unlabeled eye with an icon + visible "View" label, brand-tinted per
                Frame F. The open/close behaviour and navbar-slot portal are unchanged. */}
            <button
                aria-label="View options"
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold"
                style={{
                    backgroundColor: colors.redesign.tintBg,
                    color: colors.redesign.activeText,
                }}
                onClick={() => setShowViewMenu(true)}
            >
                {activeViewIcon}
                <span>View</span>
            </button>
            {showViewMenu && (
                <div className="fixed inset-0 z-40 bg-base-100 flex flex-col animate-slide-in-right" role="dialog" aria-modal="true">
                    <div className="bg-base-200 px-3 py-3 border-b border-base-300 flex items-center justify-between">
                        <span className="text-lg font-semibold">View</span>
                        <button aria-label="Close view options" className="btn btn-ghost btn-sm btn-circle" onClick={() => setShowViewMenu(false)}>
                            <IoCloseOutline size={22} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-auto">
                        {breadcrumb}
                        {renderViewModes(() => setShowViewMenu(false))}
                        <div className="divide-y divide-base-200 border-b border-base-200">
                            <button
                                type="button"
                                aria-label="Show timeline"
                                onClick={() => {
                                    setShowViewMenu(false);
                                    setShowTimeline(true);
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-base-200 active:bg-base-200 text-base-content"
                            >
                                <span className="text-base-content/60">
                                    <IoTimeOutline size={18} />
                                </span>
                                <span className="flex-1 min-w-0 truncate">Timeline</span>
                            </button>
                        </div>
                        {showLayoutActions && (
                            <div className="divide-y divide-base-200 border-b border-base-200">
                                {canSaveLayout && (
                                    <button
                                        type="button"
                                        aria-label="Save as default layout"
                                        onClick={() => {
                                            setShowViewMenu(false);
                                            handleSaveLayout();
                                        }}
                                        disabled={defaultLayoutState.saving}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-base-200 active:bg-base-200 text-base-content disabled:opacity-50"
                                    >
                                        <span className="text-base-content/60">
                                            <IoSaveOutline size={18} />
                                        </span>
                                        <span className="flex-1 min-w-0 truncate">
                                            {defaultLayoutState.saving ? 'Saving…' : 'Save as default layout'}
                                        </span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    aria-label="Reset to default layout"
                                    onClick={() => {
                                        setShowViewMenu(false);
                                        handleResetLayout();
                                    }}
                                    disabled={!hasScratchLayout}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-base-200 active:bg-base-200 text-base-content disabled:opacity-50"
                                >
                                    <span className="text-base-content/60">
                                        <IoRefreshOutline size={18} />
                                    </span>
                                    <span className="flex-1 min-w-0 truncate">Reset to default layout</span>
                                </button>
                            </div>
                        )}
                        {!comparing && activeTab.id === DEFAULT_DIAGRAM_TAB_ID && (
                            <div className="p-4">
                                <div className="text-xs font-semibold text-base-content/50 uppercase tracking-wide mb-2">
                                    Search components
                                </div>
                                <SearchBar
                                    searchTerm={nodeSearchTerm}
                                    onSearchChange={setNodeSearchTerm}
                                    typeFilter={nodeTypeFilter}
                                    onTypeFilterChange={setNodeTypeFilter}
                                    nodeTypes={nodeTypes}
                                    forceExpanded
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );

    const content = comparing ? (
        <CompareView
            calmType={data.calmType}
            versionA={compareFrom ?? ''}
            versionB={compareTo ?? ''}
            sourceA={compareSourceA}
            sourceB={compareSourceB}
            diffResult={diffResult}
            error={compareError}
        />
    ) : (
        activeTab.render(tabContext)
    );

    const timelineBar = (
        <TimelineBar
            moments={moments}
            currentVersion={data.version}
            displayName={displayName}
            timelineCurrentMomentId={timelineCurrentMomentId}
            timelineIsExplicit={timelineIsExplicit}
            compareFrom={compareFrom}
            compareTo={compareTo}
            diffResult={diffResult}
            loadChangesForVersion={loadChangesForVersion}
            onNavigate={handleVersionChange}
            onCompare={startCompare}
        />
    );

    // Desktop keeps the original layout: section header with inline tabs, card
    // chrome, and an inline timeline bar.
    if (!isMobile) {
        return (
            <div className={`w-full h-full py-4 pl-2 ${hasDetailsPanel ? 'pr-2' : 'pr-4'}`}>
                <div className="h-full bg-base-100 rounded-box overflow-hidden flex flex-col shadow-xl">
                    <SectionHeader
                        icon={<Icon className="text-[var(--color-interaction)]" />}
                        namespace={data.name}
                        id={data.id}
                        version={data.version}
                        typeSegment={urlType}
                        showVersion={false}
                        displayName={displayName}
                        typeLabel={typeLabel}
                        rightContent={
                            <div className="flex items-center gap-2">
                                {tabs}
                                {extensionActions}
                                {layoutActions}
                            </div>
                        }
                        breadcrumbs={breadcrumbs}
                        onBreadcrumbClick={handleBreadcrumbClick}
                    />
                    {layoutSaveError}
                    <div className="flex-1 min-h-0 overflow-hidden">{content}</div>
                    {timelineBar}
                </div>
            </div>
        );
    }

    // Mobile: full-bleed render pane; the view-options menu (which now also
    // contains the component search and the timeline action) lives in the navbar
    // right-hand actions — nothing floats over the canvas where iOS chrome would
    // hide it.
    return (
        <NodeSearchProvider value={nodeSearch}>
        <div className="w-full h-full">
            {navbarSlot ? createPortal(<>{viewMenu}{extensionActions}</>, navbarSlot) : <>{viewMenu}{extensionActions}</>}
            <div className="h-full bg-base-100 overflow-hidden flex flex-col">
                {/* Mobile has no SectionHeader (full-bleed canvas), so after a
                    detailed-architecture hop the trail would be unreachable.
                    iOS-style single back chip instead: one full-width tap target
                    to the immediate parent, mirroring Hub's Explore bar. Absent
                    without a trail, so the plain diagram view stays full-bleed. */}
                {breadcrumbs && breadcrumbs.length > 0 && (
                    <button
                        className="w-full flex items-center gap-2 px-4 py-2 bg-base-200 border-b border-base-300 text-sm text-primary shrink-0"
                        onClick={() =>
                            handleBreadcrumbClick(breadcrumbs[breadcrumbs.length - 1], breadcrumbs.length - 1)
                        }
                    >
                        <IoChevronBackOutline size={16} className="shrink-0" />
                        <span className="truncate">
                            Back to {breadcrumbs[breadcrumbs.length - 1].name || breadcrumbs[breadcrumbs.length - 1].id}
                        </span>
                    </button>
                )}
                {layoutSaveError}
                <div className="flex-1 min-h-0 overflow-hidden relative">
                    {content}
                </div>
            </div>

            {showTimeline && (
                <div className="fixed inset-0 z-40 bg-base-100 flex flex-col animate-slide-in-right" role="dialog" aria-modal="true">
                    <MobileTimeline
                        moments={moments}
                        currentVersion={data.version}
                        displayName={displayName}
                        timelineCurrentMomentId={timelineCurrentMomentId}
                        timelineIsExplicit={timelineIsExplicit}
                        loadChangesForVersion={loadChangesForVersion}
                        onNavigate={handleVersionChange}
                        onClose={() => setShowTimeline(false)}
                    />
                </div>
            )}
        </div>
        </NodeSearchProvider>
    );
}
