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
 * Full-pane view for a selected control. Styled like the domain explore page it
 * is reached from — same page surface, breadcrumb, shield tile and title — with
 * the Requirement / Configuration content in bordered cards below. The single
 * readable/raw toggle drives {@link ControlDetailSection}.
 */
export function ControlPanel({ controlData }: ControlPanelProps) {
    const [viewMode, setViewMode] = useState<ViewMode>('readable');
    const controlLabel = controlData.controlTitle ?? controlData.controlName;

    return (
        <div className="w-full h-full flex flex-col bg-base-100 overflow-hidden">
            <div className="shrink-0 pt-8 px-6 sm:px-10 pb-5">
                <nav className="text-[13px] mb-4" aria-label="Breadcrumb">
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

                <div className="flex items-center gap-3">
                    <div
                        className="flex items-center justify-center shrink-0 rounded-[11px]"
                        style={{ width: 44, height: 44, backgroundColor: colors.redesign.tintBg }}
                    >
                        <IoShieldCheckmarkOutline
                            size={22}
                            style={{ color: colors.redesign.primaryText }}
                        />
                    </div>
                    <h1
                        className="flex-1 min-w-0 truncate text-[27px] font-bold"
                        style={{ color: colors.redesign.ink }}
                    >
                        {controlLabel}
                    </h1>
                    <ViewToggle mode={viewMode} onChange={setViewMode} />
                </div>
            </div>

            <div className="flex-1 min-h-0 px-6 sm:px-10 pb-8">
                <ControlDetailSection controlData={controlData} viewMode={viewMode} />
            </div>
        </div>
    );
}
