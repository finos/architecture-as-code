import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { IoShieldCheckmarkOutline } from 'react-icons/io5';
import { ControlService } from '../../../service/control-service.js';
import { ControlData, ControlDetail } from '../../../model/control.js';
import { colors } from '../../../theme/colors.js';
import { ControlCard } from './ControlCard.js';

interface DomainPageProps {
    domain: string;
    /** Control count for the header meta (from the domain counts endpoint). */
    controlCount: number;
    /** Opens a control's detail panel (kept on-page beside the card grid). */
    onControlLoad: (control: ControlData) => void;
    /** Id of the control whose detail panel is open, for selected-card styling. */
    selectedControlId?: number;
}

/**
 * Control-domain browse page. Phase 1 = breadcrumb + header + a list of the
 * domain's controls; selecting one loads it via the existing `onControlLoad`
 * mechanism (ControlDetailSection), preserving control browsing.
 */
export function DomainPage({ domain, controlCount, onControlLoad, selectedControlId }: DomainPageProps) {
    const controlService = useMemo(() => new ControlService(), []);
    const [controls, setControls] = useState<ControlDetail[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setControls([]);
        controlService
            .fetchControlsForDomain(domain)
            .then((result) => {
                if (!cancelled) setControls(result);
            })
            .catch(() => {
                if (!cancelled) setControls([]);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [domain, controlService]);

    return (
        <div className="h-full overflow-auto bg-base-100" style={{ padding: '32px 40px' }}>
            <nav className="text-[13px] mb-4" aria-label="Breadcrumb">
                <Link to="/" className="no-underline hover:underline" style={{ color: colors.redesign.mutedAlt }}>
                    Explore
                </Link>
                <span style={{ color: colors.redesign.mutedAlt }}> / </span>
                <span className="font-semibold" style={{ color: colors.redesign.bodyStrong }}>
                    {domain}
                </span>
            </nav>

            <div className="flex items-center gap-3">
                <div
                    className="flex items-center justify-center shrink-0 rounded-[11px]"
                    style={{ width: 44, height: 44, backgroundColor: colors.redesign.tintBg }}
                >
                    <IoShieldCheckmarkOutline size={22} style={{ color: colors.redesign.primary }} />
                </div>
                <h1 className="flex-1 min-w-0 truncate text-[27px] font-bold" style={{ color: colors.redesign.ink }}>
                    {domain}
                </h1>
                <span className="font-mono-jb text-[13px] whitespace-nowrap" style={{ color: colors.redesign.mutedAlt }}>
                    {controlCount} {controlCount === 1 ? 'control' : 'controls'}
                </span>
            </div>

            <div className="mt-8">
                {loading ? (
                    <div className="flex items-center justify-center py-10">
                        <span className="loading loading-spinner loading-md text-base-content/50" />
                    </div>
                ) : controls.length === 0 ? (
                    <p className="text-[14px]" style={{ color: colors.redesign.muted }}>
                        No controls in this domain yet.
                    </p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {controls.map((control) => (
                            <ControlCard
                                key={control.id}
                                name={control.title ?? control.name}
                                description={control.description}
                                controlId={control.id}
                                active={control.id === selectedControlId}
                                onActivate={() =>
                                    onControlLoad({
                                        domain,
                                        controlId: control.id,
                                        controlName: control.name,
                                        controlDescription: control.description,
                                        controlTitle: control.title,
                                    })
                                }
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
