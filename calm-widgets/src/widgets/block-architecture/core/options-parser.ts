import { BlockArchOptions, NormalizedOptions } from '../types';
import { compact } from 'lodash';

/**
 * Parses a comma-separated string into an array of trimmed, non-empty strings.
 * Returns an empty array if the input is only whitespace.
 */
const csv = (s?: string) => (s ? compact(s.split(',').map(x => x.trim())) : undefined);


/**
 * Picks a valid enum value if present; otherwise returns the fallback.
 */
const pickEnum = <T extends string>(
    value: unknown,
    allowed: readonly T[],
    fallback: T
): T => {
    return typeof value === 'string' && (allowed as readonly string[]).includes(value)
        ? (value as T)
        : fallback;
};

/**
 * Parses raw widget options from the external API format (with kebab-case keys and string values)
 * into a normalized internal format with proper types and defaults.
 */
export function parseOptions(raw?: BlockArchOptions): NormalizedOptions {
    const o: NormalizedOptions = {
        includeContainers: 'all',
        includeChildren: 'all',
        edges: 'connected',
        direction: 'both',
        renderInterfaces: false,
        edgeLabels: 'description',
        collapseRelationships: false,
    };

    if (!raw) return o;

    if (raw['focus-nodes']) o.focusNodes = csv(raw['focus-nodes']);
    if (raw['focus-relationships']) o.focusRelationships = csv(raw['focus-relationships']);
    if (raw['focus-flows']) o.focusFlows = csv(raw['focus-flows']);
    if (raw['focus-interfaces']) o.focusInterfaces = csv(raw['focus-interfaces']);
    if (raw['focus-controls']) o.focusControls = csv(raw['focus-controls']);

    if (raw['highlight-nodes']) o.highlightNodes = csv(raw['highlight-nodes']);
    if (raw['node-types']) o.nodeTypes = csv(raw['node-types']);
    if (raw['render-interfaces']) o.renderInterfaces = true;
    if (raw['collapse-relationships']) o.collapseRelationships = true;

    o.edgeLabels = pickEnum(raw['edge-labels'], ['description', 'none'] as const, o.edgeLabels);
    o.direction = pickEnum(raw['direction'], ['both', 'in', 'out'] as const, o.direction);
    o.includeContainers = pickEnum(
        raw['include-containers'],
        ['none', 'parents', 'all'] as const,
        o.includeContainers
    );
    o.includeChildren = pickEnum(
        raw['include-children'],
        ['none', 'direct', 'all'] as const,
        o.includeChildren
    );
    o.edges = pickEnum(
        raw['edges'],
        ['connected', 'seeded', 'all', 'none'] as const,
        o.edges
    );

    if (raw['link-prefix']) o.linkPrefix = raw['link-prefix'];
    if (raw['link-map']) {
        try {
            if (typeof raw['link-map'] === 'string') {
                o.linkMap = JSON.parse(raw['link-map']);
            } else {
                o.linkMap = raw['link-map'];
            }
        } catch {
            // ignore bad JSON; keep linkMap undefined
        }
    }

    return o;
}
