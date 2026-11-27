import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { IoArrowForwardOutline } from 'react-icons/io5';
import { ExtensionSummary } from '../../../model/extensions.js';
import { colors } from '../../../theme/colors.js';
import { ExtensionLogo } from '../../../extensions/ExtensionLogo.js';
import { ScreenErrorBoundary } from '../../../extensions/ScreenErrorBoundary.js';
import { ExtensionNavLink, slotContributions } from '../../../extensions/contributions.js';
import { useExtensionService } from '../../../extensions/ExtensionsContext.js';
import { CardHeadline, cardHeadline } from '../../../extensions/landingCard.js';
import { isBlocksReply } from '../../../extensions/blocks/reply.js';

/** The headline of the extension's first landing card that needs no context. A failed or invalid reply shows no headline. */
function useCardHeadline(extension: ExtensionSummary): CardHeadline | undefined {
    const service = useExtensionService();
    const card = slotContributions(extension, 'landing-card', {})[0];
    const route = card && extension.routes.find((entry) => entry.id === card.route);
    const [headline, setHeadline] = useState<CardHeadline>();
    useEffect(() => {
        if (!route || route.method !== 'GET') return;
        const controller = new AbortController();
        service
            .call(extension.id, route, {}, controller.signal)
            .then((reply) => {
                if (!controller.signal.aborted && isBlocksReply(reply, extension.hubApi)) setHeadline(cardHeadline(reply.blocks));
            })
            .catch(() => {});
        return () => controller.abort();
    }, [service, extension.id, extension.hubApi, route]);
    return headline;
}

function Headline({ headline }: { headline: CardHeadline }) {
    if (headline.kind === 'alert') {
        return (
            <span className="text-[12px] truncate" style={{ color: colors.redesign.body }} title={headline.text}>
                {headline.text}
            </span>
        );
    }
    return (
        // Wrap rather than truncate: a tooltip does not help on a touch screen.
        <dl
            data-testid="extension-card-figures"
            className="grid gap-2 m-0"
            style={{ gridTemplateColumns: `repeat(${headline.items.length}, minmax(0, 1fr))` }}
        >
            {headline.items.map((item, index) => (
                <div key={index} className="min-w-0 flex flex-col">
                    <dt className="text-[11px] leading-tight break-words line-clamp-2" style={{ color: colors.redesign.muted }} title={item.label}>
                        {item.label}
                    </dt>
                    <dd className="m-0 text-[15px] font-semibold leading-tight break-words" style={{ color: colors.redesign.bodyStrong }}>
                        {item.value}
                    </dd>
                </div>
            ))}
        </dl>
    );
}

function PageLinks({ links, labelledBy }: { links: ExtensionNavLink[]; labelledBy: string }) {
    return (
        // A negative margin so that the link text lines up with the name, and the hover colour reaches past it.
        <ul aria-labelledby={labelledBy} className="mt-2 -mx-2">
            {links.map((link) => (
                <li key={link.key} style={{ borderTop: `1px solid ${colors.redesign.border}` }}>
                    <Link
                        to={link.to}
                        className="flex items-center justify-between gap-2 rounded-md px-2 py-2 text-[13px] no-underline hover:bg-base-200 transition-colors"
                        style={{ color: colors.redesign.bodyStrong }}
                    >
                        {/* Not clamped: two titles can differ only at the end. */}
                        <span className="min-w-0 wrap-anywhere">{link.title}</span>
                        <IoArrowForwardOutline aria-hidden="true" className="shrink-0" style={{ color: colors.redesign.muted }} />
                    </Link>
                </li>
            ))}
        </ul>
    );
}

interface ExtensionCardProps {
    extension: ExtensionSummary;
    /** The pages of the extension, from `extensionNavLinks()`. */
    links: ExtensionNavLink[];
}

function ExtensionCardContent({ extension, links }: ExtensionCardProps) {
    const headline = useCardHeadline(extension);
    const nameId = useId();
    return (
        <div
            data-testid="browse-extension"
            className="flex flex-col gap-1 rounded-xl px-4 py-3 min-w-0"
            style={{ border: `1px solid ${colors.redesign.border}`, color: colors.redesign.bodyStrong }}
        >
            <span className="flex items-center gap-2 min-w-0">
                <ExtensionLogo extension={extension} size={20} />
                <span id={nameId} className="min-w-0 line-clamp-2 wrap-anywhere font-medium text-[14px]" title={extension.name}>
                    {extension.name}
                </span>
            </span>
            {extension.provider && (
                <span className="text-[12px] line-clamp-2 wrap-anywhere" style={{ color: colors.redesign.muted }} title={extension.provider}>
                    {extension.provider}
                </span>
            )}
            {headline && <Headline headline={headline} />}
            {links.length > 0 && <PageLinks links={links} labelledBy={nameId} />}
        </div>
    );
}

/** A compact home page card: the extension's name, provider and landing card headline, and a link to each of its pages. */
export function ExtensionCard(props: ExtensionCardProps) {
    return (
        <ScreenErrorBoundary>
            <ExtensionCardContent {...props} />
        </ScreenErrorBoundary>
    );
}
