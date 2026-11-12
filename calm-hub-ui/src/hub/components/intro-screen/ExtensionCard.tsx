import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExtensionSummary } from '../../../model/extensions.js';
import { colors } from '../../../theme/colors.js';
import { ExtensionMarker } from '../../../extensions/ExtensionMarker.js';
import { ScreenErrorBoundary } from '../../../extensions/ScreenErrorBoundary.js';
import { screenPath } from '../../../extensions/contributions.js';
import { useExtensionService } from '../../../extensions/ExtensionsContext.js';
import { CardHeadline, cardHeadline } from '../../../extensions/landingCard.js';
import { isBlocksReply } from '../../../extensions/blocks/reply.js';

/** The headline of the extension's first landing card. A failed or invalid reply shows no headline. */
function useCardHeadline(extension: ExtensionSummary): CardHeadline | undefined {
    const service = useExtensionService();
    const card = extension.contributes['landing-card']?.[0];
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

function ExtensionCardContent({ extension }: { extension: ExtensionSummary }) {
    const headline = useCardHeadline(extension);
    const screen = extension.contributes.screen?.[0];
    const style = { border: `1px solid ${colors.redesign.border}`, color: colors.redesign.bodyStrong };
    const body = (
        <>
            <span className="flex items-center gap-2 min-w-0">
                <ExtensionMarker extensionId={extension.id} />
                <span className="min-w-0 line-clamp-2 wrap-anywhere font-medium text-[14px]" title={extension.name}>
                    {extension.name}
                </span>
            </span>
            {extension.provider && (
                <span className="text-[12px] line-clamp-2 wrap-anywhere" style={{ color: colors.redesign.muted }} title={extension.provider}>
                    {extension.provider}
                </span>
            )}
            {headline && <Headline headline={headline} />}
        </>
    );
    const className = 'flex flex-col gap-1 rounded-xl px-4 py-3 no-underline min-w-0';
    if (!screen) {
        return (
            <div data-testid="browse-extension" className={className} style={style}>
                {body}
            </div>
        );
    }
    return (
        <Link
            to={screenPath(extension, screen)}
            data-testid="browse-extension"
            className={`${className} hover:bg-base-200 transition-colors`}
            style={style}
        >
            {body}
        </Link>
    );
}

/** A compact home page card: the extension's name, provider and landing card headline. Opens its first screen. */
export function ExtensionCard({ extension }: { extension: ExtensionSummary }) {
    return (
        <ScreenErrorBoundary>
            <ExtensionCardContent extension={extension} />
        </ScreenErrorBoundary>
    );
}
