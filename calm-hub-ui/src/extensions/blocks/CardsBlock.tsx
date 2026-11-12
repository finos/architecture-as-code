import { ScreenLinkValue } from '../../model/extensions.js';
import { ScreenLink } from '../ScreenLink.js';

export function CardsBlock({ items }: { items: { title: string; subtitle?: string; link?: ScreenLinkValue }[] }) {
    return (
        <div className="grid grid-cols-1 @md:grid-cols-3 gap-3">
            {items.map((item, index) => (
                <div key={index} className="min-w-0 rounded-box border border-base-300 bg-base-100 px-4 py-3">
                    <div className="font-semibold wrap-anywhere">{item.title}</div>
                    {item.subtitle && <div className="text-sm text-base-content/60 wrap-anywhere">{item.subtitle}</div>}
                    {item.link && (
                        <ScreenLink link={item.link} className="link link-primary no-underline text-sm mt-2 inline-block max-w-full wrap-anywhere">
                            {item.link.label} →
                        </ScreenLink>
                    )}
                </div>
            ))}
        </div>
    );
}
