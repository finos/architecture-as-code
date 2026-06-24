import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { IoShieldCheckmarkOutline } from 'react-icons/io5';
import { ControlService } from '../../../service/control-service.js';
import { ControlData, ControlDetail } from '../../../model/control.js';
import { colors } from '../../../theme/colors.js';

interface DomainPageProps {
    domain: string;
    /** Control count for the header meta (from the domain counts endpoint). */
    controlCount: number;
    /** Loads a control into the existing ControlDetailSection flow. */
    onControlLoad: (control: ControlData) => void;
}

/**
 * Control-domain browse page. Phase 1 = breadcrumb + header + a list of the
 * domain's controls; selecting one loads it via the existing `onControlLoad`
 * mechanism (ControlDetailSection), preserving control browsing.
 */
export function DomainPage({ domain, controlCount, onControlLoad }: DomainPageProps) {
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
                    <ul className="flex flex-col gap-1">
                        {controls.map((control) => (
                            <li key={control.id}>
                                <button
                                    className="w-full text-left px-3 py-2 rounded-[7px] text-[14px] hover:bg-base-200"
                                    style={{ color: colors.redesign.bodyStrong }}
                                    onClick={() =>
                                        onControlLoad({
                                            domain,
                                            controlId: control.id,
                                            controlName: control.name,
                                            controlDescription: control.description,
                                        })
                                    }
                                >
                                    {control.name}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
