import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { resourcePath } from '../hub/routes.js';
import { HubTarget, ScreenLinkValue } from '../model/extensions.js';

/** An extension sends data, so only http and https URLs become external links. */
export function safeHref(href: string | undefined): string | undefined {
    if (!href) return undefined;
    try {
        const url = new URL(href);
        return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined;
    } catch {
        return undefined;
    }
}

// resourcePath throws on a missing part, and that would replace the whole slot for one bad link. A browser resolves a
// dot segment, even encoded, so a "." or ".." part would open another page.
const isHubTarget = (hub: Partial<HubTarget>): hub is HubTarget =>
    [hub.namespace, hub.type, hub.id, hub.version].every(
        (part) => typeof part === 'string' && part !== '' && part !== '.' && part !== '..'
    );

export function ScreenLink({ link, className, children }: { link: ScreenLinkValue; className?: string; children?: ReactNode }) {
    const content = children ?? link.label;
    if (link.hub) {
        if (!isHubTarget(link.hub)) return <span>{content}</span>;
        return (
            <Link to={resourcePath(link.hub)} className={className}>
                {content}
            </Link>
        );
    }
    const href = safeHref(link.href);
    if (!href) {
        return <span>{content}</span>;
    }
    return (
        <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
            {content} ↗
        </a>
    );
}
