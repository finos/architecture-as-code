import {
  CalmNodeSchema,
  CalmRelationshipSchema,
  CalmRelationshipTypeSchema,
} from '@finos/calm-models/types';

/**
 * Utility functions for working with CALM (Common Architecture Language Model) data
 *
 * These functions extract properties from CALM objects following the schema conventions.
 * The CALM schema uses kebab-case property names (e.g., 'unique-id', 'node-type').
 */

/**
 * Extracts the unique-id from a CALM object (node or relationship)
 *
 * @param obj - A CALM node or relationship object
 * @returns The unique-id string if found, undefined otherwise
 */
export function extractId(obj: CalmNodeSchema | CalmRelationshipSchema | null | undefined): string | undefined {
  return obj?.['unique-id'];
}

/**
 * Extracts the node-type from a CALM node object
 *
 * @param node - A CALM node object
 * @returns The node-type string if found, undefined otherwise
 */
export function extractNodeType(node: CalmNodeSchema | null | undefined): string | undefined {
  return node?.['node-type'];
}

/**
 * Extracts the relationship-type property from a CALM relationship object
 *
 * @param relationship - A CALM relationship object
 * @returns The relationship-type object if found, undefined otherwise
 */
export function extractRelationshipType(relationship: CalmRelationshipSchema | null | undefined): CalmRelationshipTypeSchema | undefined {
  return relationship?.['relationship-type'];
}

export type DetailedArchResolution =
    | { type: 'internal'; path: string }
    | { type: 'external' }
    | { type: 'unknown' };

export interface ParsedCALMHubPath {
    namespace: string;
    type: 'architectures' | 'patterns';
    id: string;
    version: string;
}

/**
 * Parses a CALM Hub resource path (`/calm/namespaces/<ns>/<architectures|patterns>/<id>/versions/<v>`)
 * into its segments, or returns null for any other shape.
 */
export function parseCALMHubPath(path: string): ParsedCALMHubPath | null {
    const match = path.match(/^\/calm\/namespaces\/([^/]+)\/(architectures|patterns)\/([^/]+)\/versions\/([^/]+)$/);
    if (!match) return null;
    return { namespace: match[1], type: match[2] as 'architectures' | 'patterns', id: match[3], version: match[4] };
}

/**
 * Resolves a detailed-architecture reference to one of three outcomes:
 *  - 'internal': a CALM Hub resource path (bare, or inside a same-hostname URL)
 *    → navigate within the app, using `path`
 *  - 'external': an absolute URL that is not an internal resource → open in a new tab
 *  - 'unknown': any other value → display as plain text
 *
 * Matching is intentionally by hostname, not same-origin: in local dev the UI
 * (e.g. :5173) and the hub backend (:8080) share a hostname but not a port, and
 * hub-issued absolute URLs must still resolve as internal. Only paths that parse
 * as a CALM Hub resource count as internal, so consumers never render an in-app
 * navigation affordance for a path the router cannot handle.
 *
 * The `hostname` parameter defaults to `window.location.hostname` and can be
 * overridden in tests.
 */
export function resolveDetailedArchitecture(
    ref: string | undefined,
    hostname: string = window.location.hostname,
): DetailedArchResolution {
    if (!ref) return { type: 'unknown' };

    if (ref.startsWith('http://') || ref.startsWith('https://')) {
        try {
            const url = new URL(ref);
            if (url.hostname === hostname && parseCALMHubPath(url.pathname)) {
                return { type: 'internal', path: url.pathname };
            }
            return { type: 'external' };
        } catch {
            return { type: 'external' };
        }
    }

    if (parseCALMHubPath(ref)) {
        return { type: 'internal', path: ref };
    }

    return { type: 'unknown' };
}

export function getRelationshipTypeDisplayString(relType: CalmRelationshipTypeSchema | null | undefined): string {
  if (!relType) return 'unknown';
  if ('connects' in relType) return 'connects';
  if ('interacts' in relType) return 'interacts';
  if ('deployed-in' in relType) return 'deployed-in';
  if ('composed-of' in relType) return 'composed-of';
  if ('options' in relType) return 'options';
  return 'unknown';
}
