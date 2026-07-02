import {
    type NamespaceResourceType,
    getResourceTypeColors,
    getResourceTypeMeta,
} from './resource-type-meta.js';

interface TypeBadgeProps {
    /** Resource type whose accent / tint and singular label the pill shows. */
    type: NamespaceResourceType;
}

/**
 * A small pill labelling a resource type: soft type-tint background + type-accent
 * text. Reused on item cards now and (in later phases) in breadcrumbs and the node
 * drawer. Colour and label come from the shared resource-type metadata so every
 * surface stays consistent.
 */
export function TypeBadge({ type }: TypeBadgeProps) {
    const { accent, tint } = getResourceTypeColors(type);
    const { label } = getResourceTypeMeta(type);

    return (
        <span
            data-testid="type-badge"
            className="inline-block text-[11px] leading-none rounded-full px-2 py-1 whitespace-nowrap"
            style={{ backgroundColor: tint, color: accent }}
        >
            {label}
        </span>
    );
}
