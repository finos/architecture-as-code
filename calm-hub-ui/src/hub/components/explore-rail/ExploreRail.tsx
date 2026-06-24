import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { IoCompassOutline, IoChevronBackOutline } from 'react-icons/io5';
import { NamespaceCounts, DomainControlCount } from '../../../model/counts.js';
import { colors } from '../../../theme/colors.js';
import { redesignTokens } from '../../../theme/redesign-tokens.js';
import { RailItem } from './RailItem.js';
import { RailSectionLabel } from './RailSectionLabel.js';

interface ExploreRailProps {
    /** Per-namespace counts, fetched once by {@link Hub} and passed down. */
    namespaceCounts: NamespaceCounts[];
    /** Per-domain control counts, fetched once by {@link Hub} and passed down. */
    domainCounts: DomainControlCount[];
    /** Collapse the rail (keeps the existing sidebar collapse affordance). */
    onCollapse?: () => void;
}

type RailRouteParams = { ns?: string; domain?: string };

/**
 * One-level browse rail replacing the desktop Explore tree: searchable
 * namespaces (with total counts) and control domains (with control counts),
 * always visible. Rows navigate to routes; the active row is derived from the
 * URL, so the rail highlight can never drift from the content pane.
 *
 * Counts are owned by {@link Hub} (the expensive counts endpoint is fetched
 * once there and shared), so this component takes them as props rather than
 * re-fetching them itself.
 */
export function ExploreRail({ namespaceCounts, domainCounts, onCollapse }: ExploreRailProps) {
    const { ns: activeNamespace, domain: activeDomain } = useParams<RailRouteParams>();

    const [filter, setFilter] = useState('');

    const needle = filter.trim().toLowerCase();
    const filteredNamespaces = useMemo(
        () => namespaceCounts.filter((nc) => nc.namespace.toLowerCase().includes(needle)),
        [namespaceCounts, needle]
    );

    return (
        <div
            className="h-full w-full flex flex-col"
            style={{
                width: redesignTokens.rail.width,
                backgroundColor: colors.redesign.surfaceAlt,
                borderRight: `1px solid ${colors.redesign.border}`,
            }}
        >
            <div className="flex items-center justify-between px-3 pt-3 pb-2">
                <h2 className="flex items-center gap-2 font-bold text-[15px]" style={{ color: colors.redesign.ink }}>
                    <IoCompassOutline style={{ color: colors.redesign.primary }} />
                    Explore
                </h2>
                {onCollapse && (
                    <button
                        aria-label="Collapse sidebar"
                        className="btn btn-ghost btn-xs btn-circle"
                        onClick={onCollapse}
                    >
                        <IoChevronBackOutline />
                    </button>
                )}
            </div>

            <div className="px-3">
                <input
                    type="text"
                    aria-label="Filter namespaces"
                    placeholder="Filter namespaces"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="w-full h-8 px-2 text-[13px] rounded-[7px] outline-none focus:ring-1"
                    style={{ border: `1px solid ${colors.redesign.borderStrong}` }}
                />
            </div>

            <div className="flex-1 overflow-auto pb-3">
                <RailSectionLabel>NAMESPACES</RailSectionLabel>
                <div className="flex flex-col gap-0.5 px-1.5">
                    {filteredNamespaces.map((nc) => (
                        <RailItem
                            key={nc.namespace}
                            label={nc.namespace}
                            count={nc.total}
                            active={nc.namespace === activeNamespace}
                            to={`/namespace/${nc.namespace}`}
                        />
                    ))}
                </div>

                <RailSectionLabel>CONTROL DOMAINS</RailSectionLabel>
                <div className="flex flex-col gap-0.5 px-1.5">
                    {domainCounts.map((dc) => (
                        <RailItem
                            key={dc.domain}
                            label={dc.domain}
                            count={dc.controlCount}
                            active={dc.domain === activeDomain}
                            to={`/domain/${dc.domain}`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
