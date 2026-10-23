import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ScreenLinkValue } from '../model/extensions.js';

export function hubPath({ namespace, type, id, version }: NonNullable<ScreenLinkValue['hub']>): string {
    return '/' + [namespace, type, id, version].map(encodeURIComponent).join('/');
}

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

export function ScreenLink({ link, className, children }: { link: ScreenLinkValue; className?: string; children?: ReactNode }) {
    const content = children ?? link.label;
    if (link.hub) {
        return (
            <Link to={hubPath(link.hub)} className={className}>
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
