// Ported from calm-hub-ui/src/visualizer/components/reactflow/utils/calmHelpers.ts (commit 8319a8f0).
// Typed against the lab's loose shapes (see ./types.ts) instead of
// @finos/calm-models; Hub-navigation helpers omitted (they resolve CALM Hub
// resource paths, which have no meaning inside the lab). Keep logic in sync
// until the shared renderer package extraction.

import type { LabCalmNode, LabCalmRelationship, LabRelationshipType } from './types';

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
export function extractId(obj: LabCalmNode | LabCalmRelationship | null | undefined): string | undefined {
    return obj?.['unique-id'];
}

/**
 * Extracts the node-type from a CALM node object
 *
 * @param node - A CALM node object
 * @returns The node-type string if found, undefined otherwise
 */
export function extractNodeType(node: LabCalmNode | null | undefined): unknown {
    return node?.['node-type'];
}

/**
 * Extracts the relationship-type property from a CALM relationship object
 *
 * @param relationship - A CALM relationship object
 * @returns The relationship-type object if found, undefined otherwise
 */
export function extractRelationshipType(relationship: LabCalmRelationship | null | undefined): LabRelationshipType | undefined {
    return relationship?.['relationship-type'];
}

/**
 * Coerces a CALM property to something React can render as a child.
 *
 * Lab addition (not in the Hub original): the lab renders the editor buffer
 * live, so a half-typed document can put an object or a number where the
 * schema wants a string. React throws on an object child, and `.toLowerCase()`
 * throws on a number — coerce here instead.
 *
 * @param value - Any value read off a CALM node or relationship
 * @returns The value as a string; '' for null/undefined
 */
export function toDisplayText(value: unknown): string {
    return value === null || value === undefined ? '' : String(value);
}

export function getRelationshipTypeDisplayString(relType: LabRelationshipType | null | undefined): string {
    if (!relType) return 'unknown';
    if ('connects' in relType) return 'connects';
    if ('interacts' in relType) return 'interacts';
    if ('deployed-in' in relType) return 'deployed-in';
    if ('composed-of' in relType) return 'composed-of';
    if ('options' in relType) return 'options';
    return 'unknown';
}
