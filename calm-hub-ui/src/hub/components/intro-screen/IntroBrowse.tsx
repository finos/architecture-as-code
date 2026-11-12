import { Link } from 'react-router-dom';
import { NamespaceCounts, DomainControlCount } from '../../../model/counts.js';
import { colors } from '../../../theme/colors.js';
import { CountBadge } from '../explore-rail/CountBadge.js';
import { useIsMobile } from '../../../hooks/useMediaQuery.js';
import { useClampToggle } from '../show-more/useClampToggle.js';
import { ShowMoreToggle } from '../show-more/ShowMoreToggle.js';
import { useExtensions } from '../../../extensions/ExtensionsContext.js';
import { ExtensionCard } from './ExtensionCard.js';

interface BrowseCardProps {
    label: string;
    count: number;
    to: string;
    testId: string;
    description?: string;
}

function BrowseCard({ label, count, to, testId, description }: BrowseCardProps) {
    const isMobile = useIsMobile();
    const { ref, expanded, showToggle, toggle } = useClampToggle<HTMLSpanElement>(description ?? '', isMobile);
    const style = { border: `1px solid ${colors.redesign.border}`, color: colors.redesign.bodyStrong };
    const heading = (
        <span className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate font-medium text-[14px]">{label}</span>
            <CountBadge count={count} />
        </span>
    );

    // Touch screens have no hover, so mobile expands the description with a toggle. A button
    // inside a link is invalid, so the toggle sits beside the link, not in it.
    if (isMobile && description) {
        return (
            <div data-testid={testId} className="flex flex-col rounded-xl px-4 py-3" style={style}>
                <Link to={to} className="flex flex-col gap-1 no-underline" style={{ color: colors.redesign.bodyStrong }}>
                    {heading}
                    <span
                        ref={ref}
                        className={`text-[12px] ${expanded ? '' : 'line-clamp-2'}`}
                        style={{ color: colors.redesign.muted }}
                    >
                        {description}
                    </span>
                </Link>
                {showToggle && <ShowMoreToggle expanded={expanded} onToggle={toggle} />}
            </div>
        );
    }

    return (
        <Link
            to={to}
            data-testid={testId}
            className="group flex flex-col gap-1 rounded-xl px-4 py-3 no-underline hover:bg-base-200 transition-colors"
            style={style}
        >
            {heading}
            {description && (
                <span
                    className="text-[12px] line-clamp-2 group-hover:line-clamp-none group-focus-visible:line-clamp-none"
                    style={{ color: colors.redesign.muted }}
                >
                    {description}
                </span>
            )}
        </Link>
    );
}

interface BrowseSectionProps {
    title: string;
    children: React.ReactNode;
    gridClassName?: string;
}

function BrowseSection({ title, children, gridClassName = 'grid-cols-2 sm:grid-cols-3' }: BrowseSectionProps) {
    return (
        <section className="w-full">
            <div
                className="font-mono-jb text-[11px] uppercase tracking-[0.1em] mb-3"
                style={{ color: colors.redesign.faintAlt }}
            >
                {title}
            </div>
            <div data-testid="browse-grid" className={`grid ${gridClassName} gap-3`}>
                {children}
            </div>
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
 * reachable from the hero, and each extension with a landing card or a screen. Renders nothing when all are empty.
 */
export function IntroBrowse({ namespaceCounts, domainCounts }: IntroBrowseProps) {
    const extensions = useExtensions().filter(
        (extension) => (extension.contributes['landing-card'] ?? []).length > 0 || (extension.contributes.screen ?? []).length > 0
    );
    if (namespaceCounts.length === 0 && domainCounts.length === 0 && extensions.length === 0) return null;

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

            {extensions.length > 0 && (
                // Wider cards than the tiles, so that the figures stay readable on a phone.
                <BrowseSection title="Extensions" gridClassName="grid-cols-1 sm:grid-cols-2">
                    {extensions.map((extension) => (
                        <ExtensionCard key={extension.id} extension={extension} />
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
