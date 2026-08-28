import { ReactNode } from 'react';

interface ControlSectionColumnProps {
    label: string;
    /** Version / configuration pickers, shown inline after the label. */
    picker?: ReactNode;
    /** Readable / raw toggle, shown right-aligned (omitted when controlled by the parent). */
    toggle?: ReactNode;
    /** Draw a divider on the right edge (used for the left column of a pair). */
    bordered?: boolean;
    children: ReactNode;
}

/**
 * One column of the desktop side-by-side control view: a header row (label +
 * pickers + toggle) above a scrolling content area.
 */
export function ControlSectionColumn({
    label,
    picker,
    toggle,
    bordered,
    children,
}: ControlSectionColumnProps) {
    return (
        <div
            className={`flex-1 min-w-0 min-h-0 flex flex-col ${bordered ? 'border-r border-base-300' : ''}`}
        >
            <div className="px-4 sm:px-6 py-2 border-b border-base-300 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-semibold text-base-content/50 uppercase tracking-wider">
                        {label}
                    </span>
                    {picker}
                </div>
                {toggle}
            </div>
            <div className="flex-1 min-h-0 overflow-auto bg-base-200">{children}</div>
        </div>
    );
}
