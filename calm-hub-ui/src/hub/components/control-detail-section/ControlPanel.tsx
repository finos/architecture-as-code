import { useState } from 'react';
import { IoShieldCheckmarkOutline, IoCloseOutline, IoEyeOutline, IoCodeOutline } from 'react-icons/io5';
import { ControlData } from '../../../model/control.js';
import { ControlDetailSection, type ViewMode } from './ControlDetailSection.js';

interface ControlPanelProps {
    controlData: ControlData;
    /** Closes the panel, returning to the domain's control card grid. */
    onClose: () => void;
}

/**
 * Right-hand detail panel for a selected control — the control-domain counterpart
 * of the diagram's node/relationship Sidebar. Clicking a control card on the
 * domain page opens this panel (desktop right column / mobile full-screen
 * takeover) while the card grid stays on the page, so closing returns to the grid
 * rather than navigating away. Wraps {@link ControlDetailSection} (requirement /
 * configuration); the single readable/raw toggle lives in this title bar next to
 * the close button (like the node Sidebar's Details/JSON switch), not in the
 * section's per-panel breadcrumbs.
 */
export function ControlPanel({ controlData, onClose }: ControlPanelProps) {
    const [viewMode, setViewMode] = useState<ViewMode>('readable');

    return (
        <div className="h-full w-full lg:w-[460px] shrink-0 lg:p-4 lg:pl-2">
            <div className="h-full bg-base-100 lg:rounded-box lg:shadow-xl flex flex-col overflow-hidden border-l border-base-300 lg:border-l-0">
                <div className="bg-base-200 px-4 py-3 border-b border-base-300 flex items-center justify-between gap-2">
                    <h2 className="text-base font-semibold flex items-center gap-2 text-primary min-w-0">
                        <IoShieldCheckmarkOutline className="shrink-0" />
                        <span>Control</span>
                    </h2>
                    <div className="flex items-center gap-1">
                        <div role="tablist" className="inline-flex rounded-lg bg-base-300 p-0.5">
                            <button
                                role="tab"
                                aria-label="Readable"
                                aria-selected={viewMode === 'readable'}
                                title="Readable"
                                className={`p-1.5 rounded-md transition-colors ${viewMode === 'readable' ? 'bg-primary text-primary-content' : 'text-base-content/50 hover:text-base-content'}`}
                                onClick={() => setViewMode('readable')}
                            >
                                <IoEyeOutline size={14} />
                            </button>
                            <button
                                role="tab"
                                aria-label="Raw JSON"
                                aria-selected={viewMode === 'raw'}
                                title="Raw JSON"
                                className={`p-1.5 rounded-md transition-colors ${viewMode === 'raw' ? 'bg-primary text-primary-content' : 'text-base-content/50 hover:text-base-content'}`}
                                onClick={() => setViewMode('raw')}
                            >
                                <IoCodeOutline size={14} />
                            </button>
                        </div>
                        <button
                            aria-label="Close control details"
                            onClick={onClose}
                            className="btn btn-ghost btn-xs btn-circle"
                        >
                            <IoCloseOutline size={20} />
                        </button>
                    </div>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden">
                    <ControlDetailSection controlData={controlData} viewMode={viewMode} />
                </div>
            </div>
        </div>
    );
}
