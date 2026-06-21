import { useCallback, useEffect, useMemo, useState } from 'react';
import { IoChevronDownOutline, IoTimeOutline } from 'react-icons/io5';
import type { DiffResult } from '@finos/calm-models/diff';
import { colors } from '../../../../theme/colors.js';
import { MomentCards } from './MomentCards.js';
import { InlineDiffSummary } from './InlineDiffSummary.js';
import { Sparkline } from './Sparkline.js';
import { VersionDetail } from './VersionDetail.js';
import type { VersionChange } from './perVersionChanges.js';

/** A single point on the timeline, derived from a version or timeline moment. */
export interface TimelineMoment {
    /** Stable key (the moment unique-id, or the version string for patterns). */
    key: string;
    /** Display label (moment name, or the version string). */
    label: string;
    /** The underlying resource version this moment maps to. */
    version: string;
    /** Moment description, when one was authored on the timeline document. */
    description?: string;
    /** Optional ISO date the moment became valid. */
    validFrom?: string;
    /** ADR references carried on the moment, if any. */
    adrs?: string[];
}

/** Persist the expand/collapse state so the bar stays open across page refreshes. */
const EXPANDED_STORAGE_KEY = 'calmHub.timelineExpanded';
/** Whether the user has interacted with the timeline at least once (drives the NEW pill). */
const SEEN_STORAGE_KEY = 'calmHub.timelineSeen';

function readExpanded(): boolean {
    try {
        return localStorage.getItem(EXPANDED_STORAGE_KEY) === 'true';
    } catch {
        return false;
    }
}

function readSeen(): boolean {
    try {
        return localStorage.getItem(SEEN_STORAGE_KEY) === '1';
    } catch {
        return false;
    }
}

interface TimelineBarProps {
    /** Moments in chronological order (oldest first, newest last). */
    moments: TimelineMoment[];
    /** The version currently being viewed in the main area. */
    currentVersion: string;
    /** Resource display name — used in the expanded panel header sub-label. */
    displayName?: string;
    /**
     * The timeline document's `current-moment` (the unique-id of the moment
     * the timeline marks as "now"). Drives the NOW badge for explicit timelines.
     */
    timelineCurrentMomentId?: string;
    /**
     * True for stored / authored timelines. The NOW badge is only shown for
     * explicit timelines because an implied projection's "current-moment" is
     * just the highest version, not an authored point in time.
     */
    timelineIsExplicit?: boolean;
    /** When comparing, the baseline (from) version — highlighted on the axis. */
    compareFrom?: string | null;
    /** When comparing, the comparison (to) version — highlighted on the axis. */
    compareTo?: string | null;
    /** Diff result shared with CompareView; drives the inline diff summary. */
    diffResult?: DiffResult | null;
    /** Navigate the main area to a moment's version (single view). */
    onNavigate: (version: string) => void;
    /** Start a diff with the given baseline (from) and comparison (to) versions. */
    onCompare: (from: string, to: string) => void;
    /**
     * Compute the list of changes between two versions of this resource, for
     * the expanded panel's WHAT CHANGED section. Returns [] when no predecessor
     * exists. Provided by DiagramSection so this component stays service-free.
     */
    loadChangesForVersion?: (prevVersion: string, currVersion: string) => Promise<VersionChange[]>;
    /**
     * Force the initial expand state and skip the persisted preference. Used by
     * the mobile bottom-sheet, which always wants the bar opened to the cards
     * view (and shouldn't leak that into the desktop inline bar's saved state).
     */
    initialExpanded?: boolean;
}

/**
 * Collapsible timeline bar pinned at the bottom of the diagram section — the
 * single version navigator + comparator for both architectures and patterns.
 *
 * Collapsed it renders the {@link Sparkline}: a dot per moment with the viewed
 * version highlighted. Expanded it renders the {@link MomentCards} above either
 * a {@link VersionDetail} (single mode) or an {@link InlineDiffSummary} (compare
 * mode). Left-click on a moment navigates to that version; right-click opens a
 * compare-from / compare-to context menu.
 */
export function TimelineBar({
    moments,
    currentVersion,
    displayName,
    timelineCurrentMomentId,
    timelineIsExplicit = false,
    compareFrom = null,
    compareTo = null,
    diffResult = null,
    onNavigate,
    onCompare,
    loadChangesForVersion,
    initialExpanded,
}: TimelineBarProps) {
    const [expanded, setExpanded] = useState<boolean>(() => initialExpanded ?? readExpanded());
    const [hasSeenTimeline, setHasSeenTimeline] = useState<boolean>(readSeen);

    // Remember the expand/collapse choice so a refresh keeps the bar as it was.
    // Skipped when initialExpanded is forced (mobile sheet) so it doesn't leak
    // into the desktop inline bar's saved preference.
    useEffect(() => {
        if (initialExpanded !== undefined) return;
        try {
            localStorage.setItem(EXPANDED_STORAGE_KEY, String(expanded));
        } catch {
            /* ignore unavailable storage */
        }
    }, [expanded, initialExpanded]);

    const markSeen = useCallback(() => {
        setHasSeenTimeline((prev) => {
            if (prev) return prev;
            try {
                localStorage.setItem(SEEN_STORAGE_KEY, '1');
            } catch {
                /* ignore unavailable storage */
            }
            return true;
        });
    }, []);

    const comparing = compareFrom !== null && compareTo !== null;

    const labelForVersion = useCallback(
        (version: string | null | undefined) =>
            (version && moments.find((m) => m.version === version)?.label) || version || '',
        [moments]
    );

    // The detail panel always reflects the current diagram (clicking a card
    // navigates to that version, which is what makes it current).
    const currentMoment = moments.find((m) => m.version === currentVersion);
    const currentIdx = moments.findIndex((m) => m.version === currentVersion);
    const previousVersion = currentIdx > 0 ? moments[currentIdx - 1].version : null;

    const loadChanges = useMemo(
        () =>
            async (): Promise<VersionChange[]> => {
                if (!previousVersion || !loadChangesForVersion) return [];
                return loadChangesForVersion(previousVersion, currentVersion);
            },
        [previousVersion, currentVersion, loadChangesForVersion]
    );

    const handleCollapse = () => {
        markSeen();
        setExpanded(false);
    };

    const handleMomentCompare = (from: string, to: string) => {
        markSeen();
        onCompare(from, to);
    };

    const handleMomentNavigate = (version: string) => {
        markSeen();
        onNavigate(version);
    };

    const headerSubLabel = comparing
        ? `· Comparing ${labelForVersion(compareFrom)} → ${labelForVersion(compareTo)}`
        : `· ${moments.length} version${moments.length === 1 ? '' : 's'}${displayName ? ' of ' + displayName : ''}`;

    return (
        <div className="bg-base-200 border-t border-base-300" data-testid="timeline-bar">
            {!expanded ? (
                <Sparkline
                    moments={moments}
                    currentVersion={currentVersion}
                    compareFrom={compareFrom}
                    compareTo={compareTo}
                    onNavigate={(version) => {
                        markSeen();
                        onNavigate(version);
                    }}
                    onCompare={(from, to) => {
                        markSeen();
                        onCompare(from, to);
                    }}
                    onExpand={() => {
                        markSeen();
                        setExpanded(true);
                    }}
                    showNewPill={!hasSeenTimeline}
                    onInteract={markSeen}
                />
            ) : (
                <div
                    data-testid="timeline-bar-expanded"
                    className="bg-white border-t font-inter"
                    style={{ borderTopColor: colors.ink[200] }}
                >
                    <div
                        className="flex items-center"
                        style={{ padding: '14px 22px 10px', gap: 10 }}
                    >
                        <IoTimeOutline size={14} style={{ color: colors.ink[500], strokeWidth: 2 }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: colors.ink[900] }}>
                            Timeline
                        </span>
                        <span style={{ fontSize: 12, color: colors.ink[500] }}>{headerSubLabel}</span>
                        <button
                            type="button"
                            className="ml-auto flex items-center justify-center bg-transparent border-0 p-0 cursor-pointer"
                            style={{ width: 28, height: 28 }}
                            onClick={handleCollapse}
                            aria-label="Collapse timeline"
                            title="Collapse timeline"
                        >
                            <IoChevronDownOutline size={14} style={{ color: colors.ink[500], strokeWidth: 2 }} />
                        </button>
                    </div>
                    <MomentCards
                        moments={moments}
                        currentVersion={currentVersion}
                        timelineCurrentMomentId={timelineCurrentMomentId}
                        timelineIsExplicit={timelineIsExplicit}
                        compareFrom={compareFrom}
                        compareTo={compareTo}
                        onNavigate={handleMomentNavigate}
                        onCompare={handleMomentCompare}
                        onInteract={markSeen}
                    />
                    {comparing ? (
                        <InlineDiffSummary diffResult={diffResult} />
                    ) : currentMoment ? (
                        <VersionDetail moment={currentMoment} loadChanges={loadChanges} />
                    ) : null}
                </div>
            )}
        </div>
    );
}
