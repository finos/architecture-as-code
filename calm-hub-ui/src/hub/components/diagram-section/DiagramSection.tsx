import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { IoConstructOutline, IoGridOutline, IoEyeOutline, IoCodeOutline, IoRocketOutline, IoTimeOutline, IoCloseOutline, IoMenuOutline } from 'react-icons/io5';
import { useIsMobile } from '../../../hooks/useMediaQuery.js';
import { Data } from '../../../model/calm.js';
import { sortVersionsDescending } from '../../../model/version.js';
import { JsonRenderer } from '../json-renderer/JsonRenderer.js';
import { Drawer } from '../../../visualizer/components/drawer/Drawer.js';
import { DeploymentPanel } from '../../../visualizer/components/reactflow/DeploymentPanel.js';
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
}

const iconMap = {
    Architectures: IoConstructOutline,
    Patterns: IoGridOutline,
} as const;

type DiagramTabType = 'diagram' | 'json' | 'deployments';

export function DiagramSection({ data, onItemSelect }: DiagramSectionProps) {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const tabParam = searchParams.get('tab') as DiagramTabType | null;
    const activeTab: DiagramTabType = tabParam ?? 'diagram';
    const isMobile = useIsMobile();
    const [showTimeline, setShowTimeline] = useState(false);
    const [showViewMenu, setShowViewMenu] = useState(false);
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

    const tabButtonClass = (tab: DiagramTabType) =>
        `btn btn-sm justify-start gap-2 ${!comparing && activeTab === tab ? 'tab-active !bg-accent !text-white' : 'btn-ghost'}`;

    // The render pane is full-bleed; the breadcrumb and view-mode switch live in
    // a menu opened from a hamburger pinned to the top-right of the canvas. On
    // mobile it opens as a full-screen overlay (like the explorer); on desktop
    // it's a dropdown.
    const breadcrumb = (
        <h2 className="text-sm font-semibold flex flex-wrap items-center gap-x-1">
            <Icon className="text-accent shrink-0" />
            {data.name}
            {typeLabel && (
                <>
                    <span className="text-gray-400">/</span> {typeLabel}
                </>
            )}
            <span className="text-gray-400">/</span>
            <span title={data.id} className="break-all">
                {displayName || data.id}
            </span>
        </h2>
    );

    const renderViewModes = (onSelect?: () => void) => (
        <div role="tablist" className="flex flex-col gap-1">
            <button role="tab" aria-label="Diagram" className={tabButtonClass('diagram')} onClick={() => { setActiveTab('diagram'); onSelect?.(); }}>
                <IoEyeOutline /> Diagram
            </button>
            <button role="tab" aria-label="JSON" className={tabButtonClass('json')} onClick={() => { setActiveTab('json'); onSelect?.(); }}>
                <IoCodeOutline /> JSON
            </button>
            {isArchitecture && (
                <button role="tab" aria-label="Deployments" className={tabButtonClass('deployments')} onClick={() => { setActiveTab('deployments'); onSelect?.(); }}>
                    <IoRocketOutline /> Deployments
                </button>
            )}
        </div>
    );

    const viewMenu = isMobile ? (
        <>
            <button
                aria-label="View options"
                className="btn btn-sm btn-circle bg-base-100 border border-base-300 shadow absolute top-2 right-2 z-20"
                onClick={() => setShowViewMenu(true)}
            >
                <IoMenuOutline size={18} />
            </button>
            {showViewMenu && (
                <div className="fixed inset-0 z-40 bg-base-100 flex flex-col animate-slide-in-right" role="dialog" aria-modal="true">
                    <div className="bg-base-200 px-3 py-3 border-b border-base-300 flex items-center justify-between">
                        <span className="text-lg font-semibold">View</span>
                        <button aria-label="Close view options" className="btn btn-ghost btn-sm btn-circle" onClick={() => setShowViewMenu(false)}>
                            <IoCloseOutline size={22} />
                        </button>
                    </div>
                    <div className="p-4 flex flex-col gap-4 overflow-auto">
                        {breadcrumb}
                        {renderViewModes(() => setShowViewMenu(false))}
                    </div>
                </div>
            )}
        </>
    ) : (
        <div className="dropdown dropdown-end absolute top-2 right-2 z-20">
            <button
                tabIndex={0}
                role="button"
                aria-label="View options"
                className="btn btn-sm btn-circle bg-base-100 border border-base-300 shadow"
            >
                <IoMenuOutline size={18} />
            </button>
            <div
                tabIndex={0}
                className="dropdown-content z-30 mt-1 w-64 rounded-box border border-base-300 bg-base-100 p-3 shadow-lg"
            >
                <div className="mb-2">{breadcrumb}</div>
                {renderViewModes()}
            </div>
        </div>
    );

    return (
        <div className="w-full h-full">
            <div className="h-full bg-base-100 overflow-hidden flex flex-col">
                <div className="flex-1 min-h-0 overflow-hidden relative">
                    {viewMenu}
                    {comparing ? (
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
                    )}

                    {/* Mobile: timeline is tucked behind a floating button so it
                        doesn't permanently occupy the short viewport. */}
                    {isMobile && !showTimeline && (
                        <button
                            type="button"
                            aria-label="Show timeline"
                            className="btn btn-sm btn-circle btn-accent shadow-lg absolute bottom-3 right-3 z-20"
                            onClick={() => setShowTimeline(true)}
                        >
                            <IoTimeOutline size={18} />
                        </button>
                    )}
                </div>

                {!isMobile && (
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
                )}
            </div>

            {isMobile && showTimeline && (
                <div className="fixed inset-0 z-40 flex flex-col justify-end" role="dialog" aria-modal="true">
                    <button
                        aria-label="Close timeline"
                        className="absolute inset-0 bg-black/40"
                        onClick={() => setShowTimeline(false)}
                    />
                    <div className="relative max-h-[75%] overflow-auto bg-base-200 rounded-t-box shadow-xl">
                        <div className="flex items-center justify-between px-4 py-2 border-b border-base-300 sticky top-0 bg-base-200 z-10">
                            <span className="font-semibold flex items-center gap-2">
                                <IoTimeOutline /> Timeline
                            </span>
                            <button
                                aria-label="Close timeline"
                                className="btn btn-ghost btn-xs btn-circle"
                                onClick={() => setShowTimeline(false)}
                            >
                                <IoCloseOutline size={18} />
                            </button>
                        </div>
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
    );
}
