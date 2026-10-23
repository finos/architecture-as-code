import { ScreenLinkValue } from '../../model/extensions.js';
import { ScreenLink } from '../ScreenLink.js';

export function CardsBlock({ items }: { items: { title: string; subtitle?: string; link?: ScreenLinkValue }[] }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {items.map((item) => (
                <div key={item.title} className="rounded-box border border-base-300 bg-base-100 px-4 py-3">
                    <div className="font-semibold">{item.title}</div>
                    {item.subtitle && <div className="text-sm text-base-content/60">{item.subtitle}</div>}
                    {item.link && (
                        <ScreenLink link={item.link} className="link link-primary no-underline text-sm mt-2 inline-block">
                            {item.link.label} →
                        </ScreenLink>
                    )}
                </div>
            ))}
        </div>
    );
}
