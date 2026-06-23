import { useEffect, useRef, useState } from 'react';
import { IoArrowForwardOutline } from 'react-icons/io5';
import { colors } from '../../../../theme/colors.js';
import type { TimelineMoment } from './TimelineBar.js';

interface MomentCardsProps {
    moments: TimelineMoment[];
    /** The version currently shown in the main diagram (drives the viewed-card outline). */
    currentVersion: string;
    /** unique-id of the timeline's current-moment — drives the NOW badge for explicit timelines. */
    timelineCurrentMomentId?: string;
    /** Whether the timeline is explicit (drives whether to show the NOW badge at all). */
    timelineIsExplicit?: boolean;
    compareFrom?: string | null;
    compareTo?: string | null;
    /** Navigate the main diagram to a moment's version. */
    onNavigate: (version: string) => void;
    onCompare: (from: string, to: string) => void;
    onInteract: () => void;
}

interface ContextMenuState {
    moment: TimelineMoment;
    x: number;
    y: number;
}

type Badge = 'NOW' | 'FROM' | 'TO' | null;

function badgeFor(
    moment: TimelineMoment,
    {
        compareFrom,
        compareTo,
        timelineCurrentMomentId,
        timelineIsExplicit,
    }: Pick<
        MomentCardsProps,
        'compareFrom' | 'compareTo' | 'timelineCurrentMomentId' | 'timelineIsExplicit'
    >
): Badge {
    if (compareFrom && moment.version === compareFrom) return 'FROM';
    if (compareTo && moment.version === compareTo) return 'TO';
    // NOW is anchored to the timeline's authored current-moment, not to the
    // version currently being viewed. Implied projections don't have a real
    // current-moment, so the badge is suppressed there.
    if (
        timelineIsExplicit &&
        timelineCurrentMomentId &&
        moment.key === timelineCurrentMomentId
    ) {
        return 'NOW';
    }
    return null;
}

/**
 * Horizontal row of version cards used in the expanded timeline panel. Each
 * card is a compact pill — version label + valid-from + optional NOW / FROM /
 * TO badge — with the same left-click-navigates / right-click-compares
 * semantics as the sparkline.
 */
export function MomentCards({
    moments,
    currentVersion,
    timelineCurrentMomentId,
    timelineIsExplicit = false,
    compareFrom = null,
    compareTo = null,
    onNavigate,
    onCompare,
    onInteract,
}: MomentCardsProps) {
    const [menu, setMenu] = useState<ContextMenuState | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);

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

    const handleClick = (moment: TimelineMoment) => {
        onInteract();
        // Always forward the selection. The parent decides whether to navigate
        // and whether to exit compare; this lets clicking the already-current
        // moment also exit compare mode.
        onNavigate(moment.version);
    };
    const handleContextMenu = (e: React.MouseEvent, moment: TimelineMoment) => {
        e.preventDefault();
        onInteract();
        setMenu({ moment, x: e.clientX, y: e.clientY });
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

    return (
        <div
            data-testid="timeline-moment-cards"
            className="flex items-center overflow-x-auto"
            style={{
                padding: '14px 22px 14px',
                borderBottom: `1px solid ${colors.ink[100]}`,
                gap: 0,
            }}
        >
            {moments.map((moment, idx) => {
                const badge = badgeFor(moment, {
                    compareFrom,
                    compareTo,
                    timelineCurrentMomentId,
                    timelineIsExplicit,
                });
                // What's currently shown in the diagram drives the pill highlight.
                // In compare mode both from and to count as "viewed" (the diff).
                const comparing = compareFrom !== null && compareTo !== null;
                const isViewed = comparing
                    ? moment.version === compareFrom || moment.version === compareTo
                    : moment.version === currentVersion;

                // The pill highlight (blue border + blueSoft bg + shadow) follows
                // the viewed card. Badges (NOW / FROM / TO) are independent.
                const borderColor = isViewed ? colors.calm.blue : colors.ink[200];
                const background = isViewed ? colors.calm.blueSoft : '#ffffff';
                const titleColor =
                    badge === 'FROM' || badge === 'TO'
                        ? colors.calm.blueDeep
                        : isViewed
                            ? colors.ink[900]
                            : colors.ink[700];

                return (
                    <div key={moment.key} className="flex items-center" style={{ gap: 0 }}>
                        {idx > 0 && (
                            <div
                                className="flex items-center shrink-0"
                                style={{ paddingInline: 8 }}
                                aria-hidden="true"
                            >
                                <IoArrowForwardOutline size={14} style={{ color: colors.ink[300] }} />
                            </div>
                        )}
                        <div className="relative shrink-0">
                            {badge && (
                                <span
                                    data-testid={`moment-badge-${moment.key}`}
                                    className="absolute font-inter text-white rounded-full"
                                    style={{
                                        top: -10,
                                        left: 10,
                                        backgroundColor: colors.calm.blueDeep,
                                        fontSize: 9.5,
                                        fontWeight: 700,
                                        letterSpacing: 0.4,
                                        padding: '2px 7px',
                                        zIndex: 1,
                                    }}
                                >
                                    {badge}
                                </span>
                            )}
                            <button
                                type="button"
                                aria-label={`Moment ${moment.label}`}
                                aria-current={isViewed ? 'true' : undefined}
                                aria-pressed={badge === 'FROM' || badge === 'TO' ? true : undefined}
                                onClick={() => handleClick(moment)}
                                onContextMenu={(e) => handleContextMenu(e, moment)}
                                className="flex flex-col items-start cursor-pointer text-left font-inter"
                                style={{
                                    background,
                                    border: `1px solid ${borderColor}`,
                                    borderRadius: 8,
                                    padding: '10px 14px',
                                    minWidth: 124,
                                    boxShadow: isViewed
                                        ? '0 6px 14px rgba(31,109,255,0.18)'
                                        : 'none',
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 13,
                                        fontWeight: isViewed ? 600 : 500,
                                        color: titleColor,
                                        // Cap + truncate long names so each card stays a
                                        // bounded, readable size; the title tooltip shows
                                        // the full name (#2728).
                                        maxWidth: 200,
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
                                        style={{ fontSize: 10.5, color: colors.ink[400], marginTop: 2 }}
                                    >
                                        {moment.validFrom}
                                    </div>
                                )}
                            </button>
                        </div>
                    </div>
                );
            })}

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
