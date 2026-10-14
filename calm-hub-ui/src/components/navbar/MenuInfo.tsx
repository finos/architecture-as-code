import { UiIdentity, UiItem } from '../../model/ui-config.js';

interface MenuInfoProps {
    identity?: UiIdentity;
    items?: UiItem[];
}

const CAPTION = 'text-xs text-base-content/60';

function Item({ item }: { item: UiItem }) {
    if (item.url) {
        const link = (
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="link link-primary break-all">
                {item.value ?? item.label}
            </a>
        );
        return item.value ? (
            <>
                <p className={CAPTION}>{item.label}</p>
                {link}
            </>
        ) : link;
    }
    return (
        <>
            <p className={CAPTION}>{item.label}</p>
            <p className="break-all">{item.value}</p>
        </>
    );
}

/** Operator-configured identity and items, shown at the bottom of the navbar drawer. */
export function MenuInfo({ identity, items }: MenuInfoProps) {
    if (!identity && !items?.length) {
        return null;
    }
    return (
        <div className="border-t border-base-200 text-sm divide-y divide-base-200">
            {identity && (
                <div className="px-4 py-3" data-testid="menu-identity">
                    <p className={CAPTION}>Signed in as</p>
                    <p className="font-medium break-all">{identity.name}</p>
                    {identity.roles && identity.roles.length > 0 && (
                        <ul className="flex flex-wrap gap-1 mt-2" aria-label="Roles">
                            {identity.roles.map((role) => (
                                <li key={role} className="badge badge-ghost badge-sm">{role}</li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
            {items && items.length > 0 && (
                <ul className="px-4 py-3 space-y-2" aria-label="Deployment information">
                    {items.map((item, i) => (
                        <li key={i}>
                            <Item item={item} />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
