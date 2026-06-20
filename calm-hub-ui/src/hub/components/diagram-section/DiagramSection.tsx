import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { IoConstructOutline, IoGridOutline, IoEyeOutline, IoCodeOutline, IoRocketOutline, IoTimeOutline, IoCloseOutline, IoCheckmarkOutline } from 'react-icons/io5';
import { useIsMobile } from '../../../hooks/useMediaQuery.js';
import { Data } from '../../../model/calm.js';
import { sortVersionsDescending } from '../../../model/version.js';
import { JsonRenderer } from '../json-renderer/JsonRenderer.js';
import { Drawer } from '../../../visualizer/components/drawer/Drawer.js';
import { SectionHeader } from '../section-header/SectionHeader.js';
import { DeploymentPanel } from '../../../visualizer/components/reactflow/DeploymentPanel.js';
import { SearchBar } from '../../../visualizer/components/reactflow/SearchBar.js';
import { NodeSearchProvider, type NodeSearchState } from '../../../visualizer/components/reactflow/node-search-context.js';
import { CompareView } from './compare/CompareView.js';
import { diffArchitectures, diffPatterns, type NodesAndRelationshipsDiffResult } from '@finos/calm-models/diff';
import type { CalmArchitectureSchema } from '@finos/calm-models/types';
import type { DiffSource } from '../../../diff/model/diff-ui-types.js';
import { TimelineBar, type TimelineMoment } from './timeline/TimelineBar.js';
import {
    currentMomentIdFromTimeline,
    isExplicitTimeline,
    momentsFromTimeline,
    momentsFromVersions,
} from './timeline/timelineMoments.js';
import { computeChanges, type VersionChange } from './timeline/perVersionChanges.js';
import { fetchVersionData, fetchVersionList } from './compare/compareData.js';
import { CalmService } from '../../../service/calm-service.js';
import type { DeploymentDecorator, SelectedItem } from '../../../visualizer/contracts/contracts.js';

interface DiagramSectionProps {
    data: Data & { calmType: 'Architectures' | 'Patterns' };
    onItemSelect?: (item: SelectedItem) => void;
    hasDetailsPanel?: boolean;
}

const iconMap = {
    Architectures: IoConstructOutline,
    Patterns: IoGridOutline,
} as const;

type DiagramTabType = 'diagram' | 'json' | 'deployments';

export function DiagramSection({ data, onItemSelect, hasDetailsPanel }: DiagramSectionProps) {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const tabParam = searchParams.get('tab') as DiagramTabType | null;
    const activeTab: DiagramTabType = tabParam ?? 'diagram';
    const isMobile = useIsMobile();
    const [showTimeline, setShowTimeline] = useState(false);
    const [showViewMenu, setShowViewMenu] = useState(false);
    // The view-options menu trigger lives in the navbar (top nav), not floating
    // over the canvas; resolve the navbar slot after mount.
    const [navbarSlot, setNavbarSlot] = useState<HTMLElement | null>(null);
    useLayoutEffect(() => {
        setNavbarSlot(document.getElementById('navbar-actions'));
    }, []);
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
    const [decorators, setDecorators] = useState<DeploymentDecorator[]>([]);
    const [compareFrom, setCompareFrom] = useState<string | null>(null);
    const [compareTo, setCompareTo] = useState<string | null>(null);
    const [versions, setVersions] = useState<string[]>([]);
    const [moments, setMoments] = useState<TimelineMoment[]>([]);
    /**
     * The timeline document's `current-moment` field — used for the NOW badge.
     * Undefined when there is no timeline doc (patterns) or when the projection
     * is implied and so the "current" moment isn't a real authored point.
     */
    const [timelineCurrentMomentId, setTimelineCurrentMomentId] = useState<string | undefined>(undefined);
    /** True for stored / authored (explicit) timelines, false for implied projections. */
    const [timelineIsExplicit, setTimelineIsExplicit] = useState<boolean>(false);
    const [displayName, setDisplayName] = useState<string | undefined>(undefined);
    /** Compare-mode data shared by CompareView (graphs) and TimelineBar (summary). */
    const [compareSourceA, setCompareSourceA] = useState<DiffSource | null>(null);
    const [compareSourceB, setCompareSourceB] = useState<DiffSource | null>(null);
    const [diffResult, setDiffResult] = useState<NodesAndRelationshipsDiffResult | null>(null);
    const [compareError, setCompareError] = useState<string | null>(null);

    const setActiveTab = (tab: DiagramTabType) => {
        setSearchParams({ tab }, { replace: true });
    };

    const isArchitecture = data.calmType === 'Architectures';
    const urlType = isArchitecture ? 'architectures' : 'patterns';
    const typeLabel = isArchitecture ? 'Architecture' : 'Pattern';

    const handleVersionChange = (version: string) => {
        // Selecting any moment exits compare mode, even if it's the
        // already-current version (otherwise compare would be a trap when one
        // of the endpoints is the version you started from).
        setCompareFrom(null);
        setCompareTo(null);
        if (version === data.version) return;
        // Preserve the active tab when switching version.
        const query = activeTab !== 'diagram' ? `?tab=${activeTab}` : '';
        navigate(`/${data.name}/${urlType}/${data.id}/${version}${query}`);
    };

    const startCompare = (from: string, to: string) => {
        setCompareFrom(from);
        setCompareTo(to);
    };

    // Fetch both compared versions and compute the diff at the section level so
    // both the CompareView (graphs) and the TimelineBar (inline diff summary)
    // share the same result.
    useEffect(() => {
        if (!compareFrom || !compareTo) {
            setCompareSourceA(null);
            setCompareSourceB(null);
            setDiffResult(null);
            setCompareError(null);
            return;
        }
        let cancelled = false;
        setCompareError(null);
        Promise.all([
            fetchVersionData(calmService, data.name, data.calmType, data.id, compareFrom),
            fetchVersionData(calmService, data.name, data.calmType, data.id, compareTo),
        ])
            .then(([a, b]) => {
                if (cancelled) return;
                const aData = (a.data ?? null) as DiffSource | null;
                const bData = (b.data ?? null) as DiffSource | null;
                setCompareSourceA(aData);
                setCompareSourceB(bData);
                setDiffResult(
                    aData && bData
                        ? data.calmType === 'Patterns'
                            ? diffPatterns(aData, bData)
                            : diffArchitectures(
                                  aData as CalmArchitectureSchema,
                                  bData as CalmArchitectureSchema
                              )
                        : null
                );
            })
            .catch(() => {
                if (!cancelled) setCompareError('Failed to load versions to compare');
            });
        return () => {
            cancelled = true;
        };
    }, [calmService, data.name, data.calmType, data.id, compareFrom, compareTo]);

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
    useEffect(() => {
        setCompareFrom(null);
        setCompareTo(null);
    }, [data.name, data.id, data.calmType]);

    // Resolve the resource's human-readable name for the breadcrumb (the route
    // carries only the id, which is often numeric).
    useEffect(() => {
        let cancelled = false;
        setDisplayName(undefined);
        const summaries = isArchitecture
            ? calmService.fetchArchitectureSummaries(data.name)
            : calmService.fetchPatternSummaries(data.name);
        summaries
            .then((list) => {
                if (cancelled) return;
                const match = list.find((s) => String(s.id) === data.id || s.customId === data.id);
                setDisplayName(match?.name);
            })
            .catch(() => {
                if (!cancelled) setDisplayName(undefined);
            });
        return () => {
            cancelled = true;
        };
    }, [calmService, data.name, data.id, isArchitecture]);

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

    // Build the timeline-bar moments. Architectures use the (explicit or
    // implied) timeline document; patterns build moments straight from the
    // version list (reversed to chronological, oldest-first) order.
    useEffect(() => {
        if (!isArchitecture) {
            // Patterns: implied timeline built from the version list — no NOW badge.
            setMoments(momentsFromVersions(versions));
            setTimelineCurrentMomentId(undefined);
            setTimelineIsExplicit(false);
            return;
        }
        let cancelled = false;
        calmService
            .fetchArchitectureTimeline(data.name, data.id)
            .then((doc) => {
                if (cancelled) return;
                setMoments(momentsFromTimeline(doc));
                setTimelineCurrentMomentId(currentMomentIdFromTimeline(doc));
                setTimelineIsExplicit(isExplicitTimeline(doc));
            })
            .catch(() => {
                // Fall back to the version list so the bar still navigates.
                if (cancelled) return;
                setMoments(momentsFromVersions(versions));
                setTimelineCurrentMomentId(undefined);
                setTimelineIsExplicit(false);
            });
        return () => {
            cancelled = true;
        };
    }, [isArchitecture, calmService, data.name, data.id, versions]);

    useEffect(() => {
        if (!isArchitecture) {
            setDecorators([]);
            return;
        }
        let cancelled = false;

        calmService
            .fetchDeploymentDecoratorsForArchitecture(data.name, data.id, data.version)
            .then((values) => { if (!cancelled) setDecorators(values as DeploymentDecorator[]); })
            .catch(() => { if (!cancelled) setDecorators([]); });

        return () => { cancelled = true; };
    }, [data, isArchitecture, calmService]);

    // When an architecture has an explicit timeline, landing on the latest
    // version (the tree's implicit default) one-shot redirects to the
    // timeline's current-moment instead — once per resource visit, so the
    // user can still navigate freely to other versions afterwards.
    const explicitRedirectedFor = useRef<string | null>(null);
    useEffect(() => {
        explicitRedirectedFor.current = null;
    }, [data.name, data.id]);
    useEffect(() => {
        if (!isArchitecture) return;
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

        const query = activeTab !== 'diagram' ? `?tab=${activeTab}` : '';
        navigate(
            `/${data.name}/${urlType}/${data.id}/${currentMoment.version}${query}`,
            { replace: true }
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
        activeTab,
        navigate,
    ]);

    const Icon = iconMap[data.calmType];
    const comparing = compareFrom !== null && compareTo !== null;

    // Desktop: inline tabs in the section header (unchanged).
    const tabs = (
        <div role="tablist" className="tabs tabs-boxed tabs-sm bg-base-100">
            <button
                role="tab"
                aria-label="Diagram"
                className={`tab gap-1 rounded-lg ${!comparing && activeTab === 'diagram' ? 'tab-active !bg-accent !text-white' : ''}`}
                onClick={() => setActiveTab('diagram')}
            >
                <IoEyeOutline />
                <span className="hidden sm:inline">Diagram</span>
            </button>
            <button
                role="tab"
                aria-label="JSON"
                className={`tab gap-1 rounded-lg ${!comparing && activeTab === 'json' ? 'tab-active !bg-accent !text-white' : ''}`}
                onClick={() => setActiveTab('json')}
            >
                <IoCodeOutline />
                <span className="hidden sm:inline">JSON</span>
            </button>
            {isArchitecture && (
                <button
                    role="tab"
                    aria-label="Deployments"
                    className={`tab gap-1 rounded-lg ${!comparing && activeTab === 'deployments' ? 'tab-active !bg-accent !text-white' : ''}`}
                    onClick={() => setActiveTab('deployments')}
                >
                    <IoRocketOutline />
                    <span className="hidden sm:inline">Deployments</span>
                </button>
            )}
        </div>
    );

    // Mobile: full-bleed render pane; the view-options menu lives in the navbar
    // and opens as a full-screen overlay styled like the explorer. The trigger
    // shows the active view icon.
    const breadcrumb = (
        <h2 className="px-4 py-3 text-sm font-medium flex flex-wrap items-center gap-x-1 border-b border-base-200 text-base-content">
            <Icon className="text-accent shrink-0" />
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

    const viewModeRow = (tab: DiagramTabType, icon: ReactNode, label: string, onSelect?: () => void) => {
        const active = !comparing && activeTab === tab;
        return (
            <button
                role="tab"
                aria-label={label}
                aria-selected={active}
                onClick={() => {
                    setActiveTab(tab);
                    onSelect?.();
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-base-200 active:bg-base-200 ${
                    active ? 'bg-base-200 text-accent font-semibold' : 'text-base-content'
                }`}
            >
                <span className={active ? 'text-accent' : 'text-base-content/60'}>{icon}</span>
                <span className="flex-1 min-w-0 truncate">{label}</span>
                {active && <IoCheckmarkOutline size={18} className="text-accent shrink-0" />}
            </button>
        );
    };

    const renderViewModes = (onSelect?: () => void) => (
        <div role="tablist" className="divide-y divide-base-200 border-b border-base-200">
            {viewModeRow('diagram', <IoEyeOutline size={18} />, 'Diagram', onSelect)}
            {viewModeRow('json', <IoCodeOutline size={18} />, 'JSON', onSelect)}
            {isArchitecture && viewModeRow('deployments', <IoRocketOutline size={18} />, 'Deployments', onSelect)}
        </div>
    );

    const activeViewIcon =
        activeTab === 'json' ? <IoCodeOutline size={20} /> : activeTab === 'deployments' ? <IoRocketOutline size={20} /> : <IoEyeOutline size={20} />;

    const viewMenu = (
        <>
            <button
                aria-label="View options"
                className="btn btn-ghost btn-circle text-primary"
                onClick={() => setShowViewMenu(true)}
            >
                {activeViewIcon}
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
                        {!comparing && activeTab === 'diagram' && (
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
    ) : activeTab === 'diagram' ? (
        <div className="w-full h-full">
            <Drawer data={data} onItemSelect={onItemSelect} decorators={decorators} />
        </div>
    ) : activeTab === 'deployments' && isArchitecture ? (
        <div className="h-full bg-base-200 overflow-auto p-4">
            <DeploymentPanel decorators={decorators} />
        </div>
    ) : (
        <div className="h-full bg-base-200 overflow-auto">
            <JsonRenderer json={data} />
        </div>
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
                        icon={<Icon className="text-accent" />}
                        namespace={data.name}
                        id={data.id}
                        version={data.version}
                        showVersion={false}
                        displayName={displayName}
                        typeLabel={typeLabel}
                        rightContent={tabs}
                    />
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
            {navbarSlot ? createPortal(viewMenu, navbarSlot) : viewMenu}
            <div className="h-full bg-base-100 overflow-hidden flex flex-col">
                <div className="flex-1 min-h-0 overflow-hidden relative">
                    {content}
                </div>
            </div>

            {showTimeline && (
                <div className="fixed inset-0 z-40 bg-base-100 flex flex-col animate-slide-in-right" role="dialog" aria-modal="true">
                    <div className="bg-base-200 px-3 py-3 border-b border-base-300 flex items-center justify-between">
                        <span className="text-lg font-semibold flex items-center gap-2">
                            <IoTimeOutline /> Timeline
                        </span>
                        <button
                            aria-label="Close timeline"
                            className="btn btn-ghost btn-sm btn-circle"
                            onClick={() => setShowTimeline(false)}
                        >
                            <IoCloseOutline size={22} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-auto">
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
                            onNavigate={(v) => { handleVersionChange(v); setShowTimeline(false); }}
                            onCompare={startCompare}
                            initialExpanded
                        />
                    </div>
                </div>
            )}
        </div>
        </NodeSearchProvider>
    );
}
