import { colors } from '../../../theme/colors.js';
import { type TypeInUI } from '../tree-navigation/navigation-loaders.js';
import { NamespaceCounts } from '../../../model/counts.js';

/**
 * The resource types shown on the namespace browse page: every UI type except
 * `Controls` (a control-domain concept, not a namespace browse type). Derived from
 * `TypeInUI` so a new browsable type can't silently miss a tab — adding one to
 * `TypeInUI` makes this union (and the `Record`s keyed on it) require it.
 */
export type NamespaceResourceType = Exclude<TypeInUI, 'Controls'>;

type ResourceTypeKey = keyof typeof colors.resourceTypes;

interface ResourceTypeMeta {
    /** Singular label used on badges (e.g. "Architecture"). */
    label: string;
    /**
     * Plural label used in running copy (e.g. empty-state messages). Held
     * explicitly rather than appending "s" to {@link label} so acronyms read
     * correctly ("ADRs", not "adrs").
     */
    pluralLabel: string;
    /** Key into `colors.resourceTypes` for the accent / tint pair. */
    colorKey: ResourceTypeKey;
}

/**
 * Maps a (plural) UI resource type to its display metadata: the singular badge
 * label and the `colors.resourceTypes` key for its accent + tint. Centralised so
 * TypeBadge, ItemCard thumbnails and the type tabs all derive colour and label
 * from one place rather than re-deriving the plural→singular / colour mapping.
 *
 * Only the six namespace browse types are represented; `Controls` is not a
 * namespace browse type and is intentionally excluded by the `NamespaceResourceType`
 * narrowing on consumers.
 */
const RESOURCE_TYPE_META: Record<NamespaceResourceType, ResourceTypeMeta> = {
    Architectures: { label: 'Architecture', pluralLabel: 'architectures', colorKey: 'architecture' },
    Patterns: { label: 'Pattern', pluralLabel: 'patterns', colorKey: 'pattern' },
    Flows: { label: 'Flow', pluralLabel: 'flows', colorKey: 'flow' },
    Standards: { label: 'Standard', pluralLabel: 'standards', colorKey: 'standard' },
    ADRs: { label: 'ADR', pluralLabel: 'ADRs', colorKey: 'adr' },
    Interfaces: { label: 'Interface', pluralLabel: 'interfaces', colorKey: 'interface' },
};

/**
 * Maps each browse type to its field on the namespace counts payload. A `Record`
 * (not a hand switch) so a new `NamespaceResourceType` fails to compile until its
 * count field is wired — shared by the desktop tabs and the mobile drill-down.
 */
export const COUNT_FIELD: Record<NamespaceResourceType, keyof NamespaceCounts> = {
    Architectures: 'architectures',
    Patterns: 'patterns',
    Flows: 'flows',
    Standards: 'standards',
    ADRs: 'adrs',
    Interfaces: 'interfaces',
};

/** Stable DOM id for a type tab button — referenced by the panel's `aria-labelledby`. */
export const tabId = (type: NamespaceResourceType) => `type-tab-${type}`;

/** Stable DOM id for the grid panel the type tabs control (their `aria-controls`). */
export const TYPE_PANEL_ID = 'namespace-type-panel';

/** The browse types in the order the tabs (and grid) present them. */
export const NAMESPACE_RESOURCE_TYPES: NamespaceResourceType[] = [
    'Architectures',
    'Patterns',
    'Flows',
    'Standards',
    'ADRs',
    'Interfaces',
];

export function getResourceTypeMeta(type: NamespaceResourceType): ResourceTypeMeta {
    return RESOURCE_TYPE_META[type];
}

/** The accent + tint colour pair for a browse resource type. */
export function getResourceTypeColors(type: NamespaceResourceType): { accent: string; tint: string } {
    return colors.resourceTypes[RESOURCE_TYPE_META[type].colorKey];
}
