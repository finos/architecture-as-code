import { useCallback, useMemo, useState } from 'react';
import {
    IoChevronBackOutline,
    IoChevronForwardOutline,
    IoCheckmarkOutline,
    IoCloseOutline,
    IoTimeOutline,
} from 'react-icons/io5';
import type { TimelineMoment } from './TimelineBar.js';
import { VersionDetail } from './VersionDetail.js';
import type { VersionChange } from './perVersionChanges.js';

interface MobileTimelineProps {
    /** Moments in chronological order (oldest first, newest last). */
    moments: TimelineMoment[];
    /** The version currently being viewed in the main area. */
    currentVersion: string;
    /** Resource display name — shown in the all-versions sub-header. */
    displayName?: string;
    /** unique-id of the timeline's current-moment — drives the NOW badge. */
    timelineCurrentMomentId?: string;
    /** Whether the timeline is explicit (drives whether the NOW badge shows at all). */
    timelineIsExplicit?: boolean;
    /**
     * Compute the changes between two versions for the detail panel's WHAT
     * CHANGED section. Returns [] when no predecessor exists.
     */
    loadChangesForVersion?: (prevVersion: string, currVersion: string) => Promise<VersionChange[]>;
    /** Navigate the main area to a moment's version. */
    onNavigate: (version: string) => void;
    /** Dismiss the whole timeline sheet. */
    onClose: () => void;
}

/** The drill-down level currently shown. */
type Level = 'detail' | 'moments';

/**
 * Mobile timeline as an iOS-style drill-down, replacing the desktop's
 * horizontally-scrolling moment cards (which are unusable on a narrow,
 * touch-only screen). The first level shows the currently-viewed moment and its
 * detail; when more moments exist, a forward chevron pushes a flat list of all
 * versions. Tapping a version navigates the diagram to it and pops back to the
 * detail level — mirroring the {@link MobileNavMenu} explorer pattern.
 */
export function MobileTimeline({
    moments,
    currentVersion,
    displayName,
    timelineCurrentMomentId,
    timelineIsExplicit = false,
    loadChangesForVersion,
    onNavigate,
    onClose,
}: MobileTimelineProps) {
    const [level, setLevel] = useState<Level>('detail');

    const isNow = useCallback(
        (moment: TimelineMoment) =>
            timelineIsExplicit && !!timelineCurrentMomentId && moment.key === timelineCurrentMomentId,
        [timelineIsExplicit, timelineCurrentMomentId]
    );

    const currentIdx = moments.findIndex((m) => m.version === currentVersion);
    const currentMoment = currentIdx >= 0 ? moments[currentIdx] : undefined;
    const previousVersion = currentIdx > 0 ? moments[currentIdx - 1].version : null;
    const hasMore = moments.length > 1;

    // The list reads newest-first (most recent at the top), the reverse of the
    // oldest-first chronological order moments arrive in.
    const listMoments = useMemo(() => [...moments].reverse(), [moments]);

    const loadChanges = useMemo(
        () =>
            async (): Promise<VersionChange[]> => {
                if (!previousVersion || !loadChangesForVersion) return [];
                return loadChangesForVersion(previousVersion, currentVersion);
            },
        [previousVersion, currentVersion, loadChangesForVersion]
    );

    const selectMoment = useCallback(
        (version: string) => {
            onNavigate(version);
            setLevel('detail');
        },
        [onNavigate]
    );

    const title = level === 'moments' ? 'All versions' : 'Timeline';

    return (
        <div className="h-full w-full flex flex-col" data-testid="mobile-timeline">
            <div className="bg-base-200 px-3 py-3 border-b border-base-300 flex items-center gap-2">
                {level === 'moments' ? (
                    <button
                        aria-label="Back"
                        className="btn btn-ghost btn-sm btn-circle"
                        onClick={() => setLevel('detail')}
                    >
                        <IoChevronBackOutline size={20} />
                    </button>
                ) : (
                    <IoTimeOutline className="text-accent ml-2" size={20} />
                )}
                <h2 className="text-lg font-semibold flex-1 min-w-0 truncate">{title}</h2>
                <button
                    aria-label="Close timeline"
                    className="btn btn-ghost btn-sm btn-circle"
                    onClick={onClose}
                >
                    <IoCloseOutline size={22} />
                </button>
            </div>

            {level === 'detail' ? (
                <div className="flex-1 overflow-auto">
                    <button
                        type="button"
                        data-testid="mobile-timeline-current"
                        disabled={!hasMore}
                        aria-label={hasMore ? 'Browse all versions' : undefined}
                        onClick={() => hasMore && setLevel('moments')}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left border-b border-base-200 enabled:hover:bg-base-200 enabled:active:bg-base-200 disabled:cursor-default"
                    >
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="font-semibold truncate">
                                    {currentMoment?.label ?? currentVersion}
                                </span>
                                {currentMoment && isNow(currentMoment) && (
                                    <span className="badge badge-primary badge-sm shrink-0">NOW</span>
                                )}
                            </div>
                            {currentMoment?.validFrom && (
                                <div className="text-xs font-mono text-base-content/50 mt-0.5">
                                    {currentMoment.validFrom}
                                </div>
                            )}
                        </div>
                        {hasMore && (
                            <span className="flex items-center gap-1 text-base-content/40 shrink-0">
                                <span className="text-sm">{moments.length}</span>
                                <IoChevronForwardOutline size={18} />
                            </span>
                        )}
                    </button>
                    {currentMoment && <VersionDetail moment={currentMoment} loadChanges={loadChanges} />}
                </div>
            ) : (
                <>
                    {displayName && (
                        <div className="px-4 py-2 text-xs text-base-content/50 border-b border-base-200">
                            {moments.length} version{moments.length === 1 ? '' : 's'} of {displayName}
                        </div>
                    )}
                    <ul
                        data-testid="mobile-timeline-list"
                        className="flex-1 overflow-auto divide-y divide-base-200"
                    >
                        {listMoments.map((moment) => {
                            const selected = moment.version === currentVersion;
                            return (
                                <li key={moment.key}>
                                    <button
                                        type="button"
                                        aria-label={`Select version ${moment.label}`}
                                        aria-current={selected ? 'true' : undefined}
                                        onClick={() => selectMoment(moment.version)}
                                        className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-base-200 active:bg-base-200 ${
                                            selected ? 'bg-base-200' : ''
                                        }`}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="truncate">{moment.label}</span>
                                                {isNow(moment) && (
                                                    <span className="badge badge-primary badge-sm shrink-0">
                                                        NOW
                                                    </span>
                                                )}
                                            </div>
                                            {moment.validFrom && (
                                                <div className="text-xs font-mono text-base-content/50 mt-0.5">
                                                    {moment.validFrom}
                                                </div>
                                            )}
                                        </div>
                                        {selected && (
                                            <IoCheckmarkOutline className="text-primary shrink-0" size={18} />
                                        )}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}
        </div>
    );
}
