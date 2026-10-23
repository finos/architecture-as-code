import { ScreenLinkValue } from '../../model/extensions.js';
import { ScreenLink } from '../ScreenLink.js';

export function LinksBlock({ items }: { items: ScreenLinkValue[] }) {
    return (
        <div className="flex flex-wrap gap-2">
            {items.map((item) => (
                <ScreenLink key={item.label} link={item} className="btn btn-sm btn-outline" />
            ))}
        </div>
    );
}
