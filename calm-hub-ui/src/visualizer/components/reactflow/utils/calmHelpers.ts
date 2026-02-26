import {
  CalmNodeSchema,
  CalmRelationshipSchema,
  CalmRelationshipTypeSchema,
} from '../../../../../../calm-models/src/types/core-types.js';

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
