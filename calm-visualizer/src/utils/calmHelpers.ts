/**
 * Utility functions for working with CALM (Common Architecture Language Model) data
 * These handle the various ID and type naming conventions that appear in CALM specifications
 */

/**
 * Extracts an ID from a CALM object, handling multiple naming conventions
 * Priority: 'unique-id' > 'unique_id' > 'id'
 *
 * @param obj - Any CALM object (node, relationship, etc.)
 * @returns The ID string if found, undefined otherwise
 */
export function extractId(obj: any): string | undefined {
  return obj?.['unique-id'] ?? obj?.unique_id ?? obj?.id;
}

/**
 * Extracts a node type from a CALM node object, handling multiple naming conventions
 * Priority: 'node-type' > 'node_type' > 'type'
 *
 * @param node - A CALM node object
 * @returns The node type string if found, undefined otherwise
 */
export function extractNodeType(node: any): string | undefined {
  return node?.['node-type'] ?? node?.node_type ?? node?.type;
}

/**
 * Extracts a relationship type property from a CALM relationship object
 * Priority: 'relationship-type' > 'relationship_type'
 *
 * @param relationship - A CALM relationship object
 * @returns The relationship type object if found, undefined otherwise
 */
export function extractRelationshipType(relationship: any): any | undefined {
  return relationship?.['relationship-type'] ?? relationship?.relationship_type;
}
