import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Destination } from '../model/extensions.js';
import { destinationLocation, safeHref } from './destinations.js';
import { useLinkState } from './returnPoints.js';

interface DestinationLinkProps {
    destination: Destination;
    className?: string;
    children: ReactNode;
}

/**
 * A link to a destination. A Hub or screen destination opens in the app and records the current page as the return
 * point; an `href` opens in a new tab, marked ↗. A destination that is not valid shows its content as text.
 */
export function DestinationLink({ destination, className, children }: DestinationLinkProps) {
    const to = destinationLocation(destination);
    const state = useLinkState(to);
    if (destination.href !== undefined) {
        const href = destination.hub === undefined && destination.screen === undefined ? safeHref(destination.href) : undefined;
        if (!href) return <span>{children}</span>;
        return (
            <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
                {children} ↗
            </a>
        );
    }
    if (!to) return <span>{children}</span>;
    return (
        <Link to={to} state={state} className={className}>
            {children}
        </Link>
    );
}
