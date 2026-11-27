import { ReactNode } from 'react';
import type { Destination, ScreenLinkValue } from '../model/extensions.js';
import { DestinationLink } from '../navigation/DestinationLink.js';

/** A block link: its destination, with its label as the text. See `DestinationLink`. */
export function ScreenLink({ link, className, children }: { link: ScreenLinkValue; className?: string; children?: ReactNode }) {
    const { label, ...destination } = link;
    return (
        <DestinationLink destination={destination as Destination} className={className}>
            {children ?? label}
        </DestinationLink>
    );
}
