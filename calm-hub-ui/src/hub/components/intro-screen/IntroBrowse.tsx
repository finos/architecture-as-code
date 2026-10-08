import { Link } from 'react-router-dom';
import { NamespaceCounts, DomainControlCount } from '../../../model/counts.js';
import { colors } from '../../../theme/colors.js';
import { CountBadge } from '../explore-rail/CountBadge.js';

interface BrowseCardProps {
    label: string;
    count: number;
    to: string;
    testId: string;
    description?: string;
}

function BrowseCard({ label, count, to, testId, description }: BrowseCardProps) {
    return (
        <Link
            to={to}
            data-testid={testId}
            className="flex flex-col gap-1 rounded-xl px-4 py-3 no-underline hover:bg-base-200 transition-colors"
            style={{ border: `1px solid ${colors.redesign.border}`, color: colors.redesign.bodyStrong }}
        >
            <span className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate font-medium text-[14px]">{label}</span>
                <CountBadge count={count} />
            </span>
            {description && (
                <span title={description} className="text-[12px] line-clamp-2" style={{ color: colors.redesign.muted }}>
                    {description}
                </span>
            )}
        </Link>
    );
}

interface BrowseSectionProps {
    title: string;
    children: React.ReactNode;
}

function BrowseSection({ title, children }: BrowseSectionProps) {
    return (
        <section className="w-full">
            <div
                className="font-mono-jb text-[11px] uppercase tracking-[0.1em] mb-3"
                style={{ color: colors.redesign.faintAlt }}
            >
                {title}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{children}</div>
        </section>
    );
}

interface IntroBrowseProps {
    namespaceCounts: NamespaceCounts[];
    domainCounts: DomainControlCount[];
}

/**
 * The intro's browse affordance: every namespace and control domain as a clickable
 * tile (the same routes the explore rail uses), so the sidebar's targets are
 * reachable from the hero. Renders nothing when the catalogue is empty.
 */
export function IntroBrowse({ namespaceCounts, domainCounts }: IntroBrowseProps) {
    if (namespaceCounts.length === 0 && domainCounts.length === 0) return null;

    return (
        <div className="w-full max-w-[640px] flex flex-col gap-10">
            {namespaceCounts.length > 0 && (
                <BrowseSection title="Namespaces">
                    {namespaceCounts.map((nc) => (
                        <BrowseCard
                            key={nc.namespace}
                            label={nc.namespace}
                            count={nc.total}
                            to={`/namespace/${encodeURIComponent(nc.namespace)}`}
                            testId="browse-namespace"
                            description={nc.description}
                        />
                    ))}
                </BrowseSection>
            )}

            {domainCounts.length > 0 && (
                <BrowseSection title="Control domains">
                    {domainCounts.map((dc) => (
                        <BrowseCard
                            key={dc.domain}
                            label={dc.domain}
                            count={dc.controlCount}
                            to={`/domain/${encodeURIComponent(dc.domain)}`}
                            testId="browse-domain"
                        />
                    ))}
                </BrowseSection>
            )}
        </div>
    );
}
