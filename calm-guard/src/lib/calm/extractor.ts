import type { CalmDocument, CalmNode, CalmRelationship, CalmFlow, ControlDefinition, Protocol } from './types';

/**
 * Structured input for agent analysis
 * Includes extracted data and computed metadata
 */
export interface AnalysisInput {
  nodes: CalmNode[];
  relationships: CalmRelationship[];
  controls: Record<string, ControlDefinition>;
  flows: CalmFlow[];
  metadata: {
    nodeCount: number;
    relationshipCount: number;
    controlCount: number;
    flowCount: number;
    nodeTypes: Record<string, number>;
    relationshipTypes: Record<string, number>;
    protocols: Protocol[];
  };
}

/**
 * Extract structured analysis input from parsed CALM document
 *
 * @param calm - Validated CALM document
 * @returns AnalysisInput with data and computed metadata
 *
 * @example
 * ```typescript
 * const input = extractAnalysisInput(calmDoc);
 * console.log('Total nodes:', input.metadata.nodeCount);
 * console.log('Service nodes:', input.metadata.nodeTypes.service);
 * ```
 */
export function extractAnalysisInput(calm: CalmDocument): AnalysisInput {
  // Count nodes by type
  const nodeTypeCounts = calm.nodes.reduce((acc, node) => {
    const nodeType = node['node-type'];
    acc[nodeType] = (acc[nodeType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Count relationships by type
  const relationshipTypeCounts = calm.relationships.reduce((acc, rel) => {
    const relType = rel['relationship-type'];
    acc[relType] = (acc[relType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Extract unique protocols from relationships
  const protocols = Array.from(
    new Set(
      calm.relationships
        .map(rel => rel.protocol)
        .filter((p): p is Protocol => p !== undefined)
    )
  );

  return {
    nodes: calm.nodes,
    relationships: calm.relationships,
    controls: calm.controls || {},
    flows: calm.flows || [],
    metadata: {
      nodeCount: calm.nodes.length,
      relationshipCount: calm.relationships.length,
      controlCount: Object.keys(calm.controls || {}).length,
      flowCount: calm.flows?.length || 0,
      nodeTypes: nodeTypeCounts,
      relationshipTypes: relationshipTypeCounts,
      protocols,
    },
  };
}

/**
 * Get all nodes of a specific type
 *
 * @param calm - CALM document
 * @param nodeType - Node type to filter by
 * @returns Array of matching nodes
 *
 * @example
 * ```typescript
 * const services = getNodesByType(calm, 'service');
 * const databases = getNodesByType(calm, 'database');
 * ```
 */
export function getNodesByType(calm: CalmDocument, nodeType: string): CalmNode[] {
  return calm.nodes.filter(node => node['node-type'] === nodeType);
}

/**
 * Get a node by its unique ID
 *
 * @param calm - CALM document
 * @param nodeId - Unique node identifier
 * @returns Node if found, undefined otherwise
 *
 * @example
 * ```typescript
 * const node = getNodeById(calm, 'auth-service');
 * if (node) {
 *   console.log('Found:', node.name);
 * }
 * ```
 */
export function getNodeById(calm: CalmDocument, nodeId: string): CalmNode | undefined {
  return calm.nodes.find(node => node['unique-id'] === nodeId);
}

/**
 * Get all relationships connected to a specific node
 *
 * @param calm - CALM document
 * @param nodeId - Unique node identifier
 * @returns Array of relationships involving the node
 *
 * @example
 * ```typescript
 * const nodeRels = getNodeRelationships(calm, 'api-gateway');
 * console.log(`${nodeRels.length} relationships found`);
 * ```
 */
export function getNodeRelationships(calm: CalmDocument, nodeId: string): CalmRelationship[] {
  return calm.relationships.filter(rel => {
    switch (rel['relationship-type']) {
      case 'interacts':
        return rel.interacts.actor === nodeId || rel.interacts.nodes.includes(nodeId);

      case 'connects':
        return rel.connects.source.node === nodeId || rel.connects.destination.node === nodeId;

      case 'deployed-in':
        return rel['deployed-in'].container === nodeId || rel['deployed-in'].nodes.includes(nodeId);

      case 'composed-of':
        return rel['composed-of'].container === nodeId || rel['composed-of'].nodes.includes(nodeId);

      case 'options':
        // Options relationship structure is undefined - skip for now
        return false;

      default: {
        // TypeScript exhaustiveness check
        const exhaustive: never = rel;
        // This should never execute - all relationship types are handled above
        throw new Error(`Unhandled relationship type: ${(exhaustive as CalmRelationship)['relationship-type']}`);
      }
    }
  });
}

/**
 * Get flows that include a specific relationship
 *
 * @param calm - CALM document
 * @param relationshipId - Unique relationship identifier
 * @returns Array of flows containing the relationship
 *
 * @example
 * ```typescript
 * const flows = getFlowsForRelationship(calm, 'conn-api-db');
 * flows.forEach(flow => console.log('Flow:', flow.name));
 * ```
 */
export function getFlowsForRelationship(calm: CalmDocument, relationshipId: string): CalmFlow[] {
  if (!calm.flows) return [];

  return calm.flows.filter(flow =>
    flow.transitions.some(t => t['relationship-unique-id'] === relationshipId)
  );
}

/**
 * Get all controls attached to a specific node or relationship
 *
 * @param entity - Node or relationship
 * @returns Controls attached to the entity (empty object if none)
 *
 * @example
 * ```typescript
 * const node = getNodeById(calm, 'payment-service');
 * if (node) {
 *   const controls = getEntityControls(node);
 *   console.log('Control count:', Object.keys(controls).length);
 * }
 * ```
 */
export function getEntityControls(entity: CalmNode | CalmRelationship): Record<string, ControlDefinition> {
  return entity.controls || {};
}

/**
 * Check if a node has a specific control
 *
 * @param entity - Node or relationship
 * @param controlId - Control identifier
 * @returns True if entity has the control
 *
 * @example
 * ```typescript
 * if (hasControl(node, 'encryption-at-rest')) {
 *   console.log('Node has encryption control');
 * }
 * ```
 */
export function hasControl(entity: CalmNode | CalmRelationship, controlId: string): boolean {
  return entity.controls !== undefined && controlId in entity.controls;
}
