import { useState } from 'react';
import { Link } from 'react-router-dom';
import { IoShieldCheckmarkOutline } from 'react-icons/io5';
import { ControlData } from '../../../model/control.js';
import { colors } from '../../../theme/colors.js';
import { ControlDetailSection, type ViewMode } from './ControlDetailSection.js';
import { ViewToggle } from './ViewToggle.js';

interface ControlPanelProps {
    controlData: ControlData;
}

/**
 * Full-pane view for a selected control — it fills the content area like an
 * architecture or document detail view rather than a side panel. A breadcrumb
 * (Explore / <domain> / <control>) navigates back; the domain crumb returns to
 * that domain's control list. The single readable/raw toggle lives in the header
 * and drives {@link ControlDetailSection}.
 */
export function ControlPanel({ controlData }: ControlPanelProps) {
    const [viewMode, setViewMode] = useState<ViewMode>('readable');
    const controlLabel = controlData.controlTitle ?? controlData.controlName;

    return (
        <div className="w-full h-full flex flex-col bg-base-100 overflow-hidden">
            <div className="bg-base-200 px-4 sm:px-6 py-3 border-b border-base-300 flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                    <nav className="text-[13px]" aria-label="Breadcrumb">
                        <Link
                            to="/"
                            className="no-underline hover:underline"
                            style={{ color: colors.redesign.mutedAlt }}
                        >
                            Explore
                        </Link>
                        <span style={{ color: colors.redesign.mutedAlt }}> / </span>
                        <Link
                            to={`/domain/${encodeURIComponent(controlData.domain)}`}
                            className="no-underline hover:underline"
                            style={{ color: colors.redesign.mutedAlt }}
                        >
                            {controlData.domain}
                        </Link>
                        <span style={{ color: colors.redesign.mutedAlt }}> / </span>
                        <span className="font-semibold" style={{ color: colors.redesign.bodyStrong }}>
                            {controlLabel}
                        </span>
                    </nav>
                    <h2 className="text-base sm:text-xl font-semibold flex items-center gap-2 mt-0.5 text-primary min-w-0">
                        <IoShieldCheckmarkOutline className="shrink-0" />
                        <span className="truncate">{controlLabel}</span>
                    </h2>
                </div>
                <ViewToggle mode={viewMode} onChange={setViewMode} />
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
                <ControlDetailSection controlData={controlData} viewMode={viewMode} />
            </div>
        </div>
    );
}
