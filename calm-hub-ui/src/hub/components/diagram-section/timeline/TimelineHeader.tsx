import type { ReactNode } from 'react';
import { IoTimeOutline } from 'react-icons/io5';
import { colors } from '../../../../theme/colors.js';

interface TimelineHeaderProps {
    /** The version currently shown in the main area — surfaced as the mono pill. */
    currentVersion: string;
    /**
     * Trailing controls (NEW pill, expand/collapse chevron). Rendered after the
     * version pill, pushed to the right by the flex row.
     */
    children?: ReactNode;
}

/**
 * Shared header for the version timeline (collapsed sparkline + expanded panel).
 *
 * Names the strip's purpose — "Browse versions" with an explanatory line — so it
 * no longer reads as an inert "Timeline" slider (redesign problem #4), and shows
 * the current version as a right-aligned mono pill. The explanatory copy makes it
 * obvious that clicking a moment re-renders both the Diagram and JSON views.
 */
export function TimelineHeader({ currentVersion, children }: TimelineHeaderProps) {
    return (
        <div className="flex items-center gap-2 shrink-0" style={{ paddingTop: 4 }}>
            <IoTimeOutline size={14} style={{ color: colors.ink[500], strokeWidth: 2 }} />
            <span
                className="font-inter"
                style={{ fontSize: 13, fontWeight: 600, color: colors.ink[900] }}
            >
                Browse versions
            </span>
            <span
                className="font-inter whitespace-nowrap hidden lg:inline"
                style={{ fontSize: 12, color: colors.ink[500] }}
            >
                — click a moment to re-render the diagram &amp; JSON at that version
            </span>
            <span
                data-testid="timeline-version-pill"
                className="font-mono-jb rounded-full"
                style={{
                    backgroundColor: colors.redesign.tintBg,
                    color: colors.redesign.primary,
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '2px 8px',
                }}
                title={`Viewing version ${currentVersion}`}
            >
                v{currentVersion}
            </span>
            {children}
        </div>
    );
}
