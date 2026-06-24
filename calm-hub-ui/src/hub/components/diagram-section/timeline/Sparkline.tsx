import { useEffect, useRef, useState } from 'react';
import { IoChevronUpOutline } from 'react-icons/io5';
import { colors } from '../../../../theme/colors.js';
import { TimelineHeader } from './TimelineHeader.js';
import type { TimelineMoment } from './TimelineBar.js';

interface SparklineProps {
    moments: TimelineMoment[];
    currentVersion: string;
    compareFrom?: string | null;
    compareTo?: string | null;
    onNavigate: (version: string) => void;
    onCompare: (from: string, to: string) => void;
    onExpand: () => void;
    /** Show the red NEW pill until the user has interacted with the timeline once. */
    showNewPill: boolean;
    /** Called on any meaningful interaction so the parent can dismiss the NEW pill. */
    onInteract: () => void;
}

interface ContextMenuState {
    moment: TimelineMoment;
    x: number;
    y: number;
}

/**
 * Collapsed timeline strip — a "Browse versions" header (with the current-version
 * pill) above a sparkline of version dots with title + date below each. Single
 * mode highlights the viewed version; compare mode shows progress between FROM and
 * TO. Left-click navigates; right-click opens a compare-from / compare-to menu.
 *
 * A single-version resource collapses to just the header + version pill — there is
 * no meaningful track to scrub, so an inert one-dot slider is suppressed.
 */
export function Sparkline({
    moments,
    currentVersion,
    compareFrom = null,
    compareTo = null,
    onNavigate,
    onCompare,
    onExpand,
    showNewPill,
    onInteract,
}: SparklineProps) {
    const [menu, setMenu] = useState<ContextMenuState | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);

    const comparing = compareFrom !== null && compareTo !== null;
    const total = moments.length;
    const singleVersion = total <= 1;
    // Evenly distribute dots from left to right. With a single moment, centre it.
    const pct = (i: number) => (total <= 1 ? 50 : (i / (total - 1)) * 100);

    // The active dot is whatever the diagram is currently showing: the viewed
    // version in single mode, or both endpoints in compare mode.
    const viewedIdx = moments.findIndex((m) => m.version === currentVersion);
    const fromIdx = comparing ? moments.findIndex((m) => m.version === compareFrom) : -1;
    const toIdx = comparing ? moments.findIndex((m) => m.version === compareTo) : -1;

    // Progress overlay: left edge to the viewed dot in single mode; between
    // FROM and TO in compare mode.
    const progressLeft = comparing && fromIdx >= 0 && toIdx >= 0 ? pct(Math.min(fromIdx, toIdx)) : 0;
    const progressRight = comparing && fromIdx >= 0 && toIdx >= 0
        ? pct(Math.max(fromIdx, toIdx))
        : viewedIdx >= 0
            ? pct(viewedIdx)
            : 0;

    useEffect(() => {
        if (!menu) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setMenu(null);
        };
        const onDown = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null);
        };
        document.addEventListener('keydown', onKey);
        document.addEventListener('mousedown', onDown);
        return () => {
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('mousedown', onDown);
        };
    }, [menu]);

    const handleDotClick = (moment: TimelineMoment) => {
        onInteract();
        // Always forward the selection so the parent can exit compare mode even
        // when the user clicks the moment that is already current.
        onNavigate(moment.version);
    };

    const handleDotContextMenu = (e: React.MouseEvent, moment: TimelineMoment) => {
        e.preventDefault();
        onInteract();
        setMenu({ moment, x: e.clientX, y: e.clientY });
    };

    const handleExpand = () => {
        onInteract();
        onExpand();
    };

    const handleCompareFrom = () => {
        if (!menu) return;
        onCompare(menu.moment.version, currentVersion);
        setMenu(null);
    };

    const handleCompareTo = () => {
        if (!menu) return;
        onCompare(currentVersion, menu.moment.version);
        setMenu(null);
    };

    const newPill = showNewPill ? (
        <span
            data-testid="timeline-new-pill"
            className="font-inter rounded-full text-white"
            style={{ backgroundColor: colors.new, fontSize: 9.5, fontWeight: 700, padding: '2px 6px' }}
        >
            NEW
        </span>
    ) : null;

    const expandButton = (
        <button
            type="button"
            onClick={handleExpand}
            aria-label="Expand timeline"
            title="Expand timeline"
            className="shrink-0 flex items-center justify-center bg-transparent border-0 p-0 cursor-pointer"
            style={{ width: 28, height: 28 }}
        >
            <IoChevronUpOutline size={14} style={{ color: colors.ink[500], strokeWidth: 2 }} />
        </button>
    );

    return (
        <div
            data-testid="timeline-bar-collapsed"
            className="flex flex-col bg-white border-t font-inter"
            style={{ borderTopColor: colors.ink[200], padding: '12px 20px 14px', gap: 8 }}
        >
            {/* Header row: purpose + version pill on the left, NEW pill + expand on the right. */}
            <div className="flex items-center gap-2">
                <TimelineHeader currentVersion={currentVersion}>{newPill}</TimelineHeader>
                <div className="ml-auto">{expandButton}</div>
            </div>

            {/* Track row. A single-version resource has nothing to scrub, so the
                track is suppressed (the version pill already states what's shown).
                overflow-hidden clips long labels at the track edge (#2728). */}
            {!singleVersion && (
                <div
                    data-testid="timeline-sparkline-track"
                    className="relative"
                    style={{ height: 72, overflow: 'hidden' }}
                >
                    {/* Inner track wrapper inset 10px each side so dot percentages map directly */}
                    <div className="absolute" style={{ left: 10, right: 10, top: 0, bottom: 0 }}>
                        <div
                            className="absolute"
                            style={{ left: 0, right: 0, top: 18, height: 2, backgroundColor: colors.ink[200] }}
                        />
                        {progressRight > progressLeft && (
                            <div
                                data-testid="timeline-progress"
                                className="absolute"
                                style={{
                                    left: `${progressLeft}%`,
                                    width: `${progressRight - progressLeft}%`,
                                    top: 18,
                                    height: 2,
                                    backgroundColor: colors.redesign.primary,
                                }}
                            />
                        )}
                        {moments.map((moment, i) => {
                            // Highlight the dot for whatever the diagram is currently showing
                            // (the viewed version). In compare mode the two endpoints are
                            // highlighted via isFrom / isTo below instead.
                            const isCurrent = !comparing && i === viewedIdx;
                            const isFrom = comparing && i === fromIdx;
                            const isTo = comparing && i === toIdx;
                            const isActive = isCurrent || isFrom || isTo;
                            // Active = filled 12px blue dot with a halo; others = 9px white
                            // dots with a slate ring (redesign #4 anatomy).
                            const dotSize = isActive ? 12 : 9;
                            return (
                                <div
                                    key={moment.key}
                                    className="absolute top-0 flex flex-col items-center"
                                    style={{ left: `${pct(i)}%`, transform: 'translateX(-50%)' }}
                                >
                                    <button
                                        type="button"
                                        aria-label={`Moment ${moment.label}`}
                                        aria-current={isCurrent ? 'true' : undefined}
                                        aria-pressed={isFrom || isTo ? true : undefined}
                                        onClick={() => handleDotClick(moment)}
                                        onContextMenu={(e) => handleDotContextMenu(e, moment)}
                                        className="bg-transparent p-0 border-0 cursor-pointer flex items-center justify-center"
                                        style={{ width: 32, height: 32 }}
                                    >
                                        <div
                                            data-active={isActive ? 'true' : undefined}
                                            style={{
                                                width: dotSize,
                                                height: dotSize,
                                                borderRadius: 999,
                                                backgroundColor: isActive ? colors.redesign.primary : '#ffffff',
                                                border: isActive
                                                    ? `2px solid ${colors.redesign.primary}`
                                                    : `1.5px solid ${colors.ink[400]}`,
                                                boxShadow: isActive
                                                    ? `0 0 0 4px ${colors.redesign.primary}33`
                                                    : 'none',
                                            }}
                                        />
                                    </button>
                                    <div
                                        className="font-inter"
                                        style={{
                                            marginTop: 4,
                                            fontSize: 12,
                                            fontWeight: isActive ? 600 : 500,
                                            color: isActive ? colors.ink[900] : colors.ink[700],
                                            textAlign: 'center',
                                            // Bound + truncate long names so the strip stays
                                            // readable; the title tooltip shows the full name (#2728).
                                            maxWidth: 120,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}
                                        title={moment.label}
                                    >
                                        {moment.label}
                                    </div>
                                    {moment.validFrom && (
                                        <div
                                            className="font-mono-jb"
                                            style={{ fontSize: 10, color: colors.ink[400] }}
                                        >
                                            {moment.validFrom}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {menu && (
                <div
                    ref={menuRef}
                    role="menu"
                    data-testid="timeline-context-menu"
                    className="fixed z-50 menu menu-sm bg-base-100 rounded-box shadow-xl border border-base-300 p-1"
                    style={{ top: menu.y, left: menu.x }}
                >
                    <li>
                        <button type="button" role="menuitem" onClick={handleCompareFrom}>
                            Compare from
                        </button>
                    </li>
                    <li>
                        <button type="button" role="menuitem" onClick={handleCompareTo}>
                            Compare to
                        </button>
                    </li>
                </div>
            )}
        </div>
    );
}
