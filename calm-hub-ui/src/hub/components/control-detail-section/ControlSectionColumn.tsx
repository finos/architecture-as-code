import { ReactNode } from 'react';
import { colors } from '../../../theme/colors.js';

interface ControlSectionColumnProps {
    label: string;
    /** Version / configuration pickers, shown inline after the label. */
    picker?: ReactNode;
    /** Readable / raw toggle, shown right-aligned (omitted when controlled by the parent). */
    toggle?: ReactNode;
    children: ReactNode;
}

/**
 * One column of the desktop side-by-side control view: a bordered card matching
 * the explore-page item cards, with a header row (label + pickers + toggle)
 * above the scrolling content.
 */
export function ControlSectionColumn({
    label,
    picker,
    toggle,
    children,
}: ControlSectionColumnProps) {
    return (
        <div
            className="flex-1 min-w-0 min-h-0 flex flex-col rounded-[12px] overflow-hidden bg-base-100"
            style={{ border: `1px solid ${colors.redesign.border}` }}
        >
            <div
                className="px-4 sm:px-5 py-2.5 flex items-center justify-between gap-3 flex-wrap"
                style={{ borderBottom: `1px solid ${colors.redesign.border}` }}
            >
                <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-semibold text-base-content/50 uppercase tracking-wider">
                        {label}
                    </span>
                    {picker}
                </div>
                {toggle}
            </div>
            <div className="flex-1 min-h-0 overflow-auto">{children}</div>
        </div>
    );
}
