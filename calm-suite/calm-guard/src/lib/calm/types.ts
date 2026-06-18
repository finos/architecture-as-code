import { z } from 'zod';

/**
 * CALM Schema Version
 * Reference: FINOS CALM v1.2 (canonical nested `relationship-type` form)
 */
export const CALM_SCHEMA_VERSION = '1.2';

/**
 * CALM Version type — supported schema versions
 * Re-exported from normalizer for convenience
 */
export type { CalmVersion } from './normalizer';

/**
 * Canonical CALM node-type enum — the 9 well-known types.
 * Kept as UI hints (labels/icons/colors), NOT as a closed validation set.
 */
export const nodeTypeEnum = z.enum([
  'actor',       // People, systems, or roles that interact with the system
  'ecosystem',   // High-level grouping of systems
  'system',      // Software systems
  'service',     // Microservices or components
  'database',    // Data stores
  'network',     // Network infrastructure
  'ldap',        // LDAP directories
  'webclient',   // Browser-based clients
  'data-asset',  // Data entities or datasets
]);

/**
 * Node Types — canonical CALM allows ANY string node-type (core defines
 * `node-type` as `anyOf:[enum, {type:string}]`). We accept any string so that
 * extension node-types from other CALM tools (e.g. `aws:lambda`) interoperate;
 * `nodeTypeEnum` remains the set we render first-class UI for.
 */
export const nodeTypeSchema = z.union([nodeTypeEnum, z.string()]);

export type NodeTypeEnum = z.infer<typeof nodeTypeEnum>;
export type NodeType = z.infer<typeof nodeTypeSchema>;

/**
 * Protocol Types
 * All 12 protocols supported in CALM v1.1
 */
export const protocolSchema = z.enum([
  'HTTP',
  'HTTPS',
  'FTP',
  'SFTP',
  'JDBC',
  'WebSocket',
  'SocketIO',
  'LDAP',
  'AMQP',
  'TLS',
  'mTLS',
  'TCP',
]);

export type Protocol = z.infer<typeof protocolSchema>;

/**
 * Interface Definition
 * Defines an interface that a node can expose
 */
export const interfaceDefinitionSchema = z.object({
  'unique-id': z.string().min(1, 'Interface unique-id is required'),
  'definition-url': z.string().url().optional(),
  config: z.unknown().optional(),
});

export type InterfaceDefinition = z.infer<typeof interfaceDefinitionSchema>;

/**
 * Control Requirement
 * References compliance or security requirement
 */
export const controlRequirementSchema = z.object({
  'requirement-url': z.string().url('Control requirement-url must be a valid URL'),
  'config-url': z.string().url().optional(),
  config: z.unknown().optional(),
});

export type ControlRequirement = z.infer<typeof controlRequirementSchema>;

/**
 * Control Definition
 * Defines a compliance or security control
 */
export const controlDefinitionSchema = z.object({
  description: z.string().min(1, 'Control description is required'),
  requirements: z.array(controlRequirementSchema).optional(),
});

export type ControlDefinition = z.infer<typeof controlDefinitionSchema>;

/**
 * CALM Node
 * Core entity representing a component in the architecture
 */
export const calmNodeSchema = z.object({
  'unique-id': z.string().min(1, 'Node unique-id is required'),
  'node-type': nodeTypeSchema,
  name: z.string().min(1, 'Node name is required'),
  description: z.string().min(1, 'Node description is required'),
  interfaces: z.array(interfaceDefinitionSchema).optional(),
  controls: z.record(z.string(), controlDefinitionSchema).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  details: z.object({
    'detailed-architecture': z.string().url().optional(),
    'required-pattern': z.string().url().optional(),
  }).optional(),
  'data-classification': z.enum(['PII', 'PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED']).optional(),
  'run-as': z.string().optional(),
});

export type CalmNode = z.infer<typeof calmNodeSchema>;

/**
 * Node Interface Reference
 * References a node and its interfaces in relationships
 */
export const nodeInterfaceSchema = z.object({
  node: z.string().min(1, 'Node reference is required'),
  interfaces: z.array(z.string()).optional(),
});

export type NodeInterface = z.infer<typeof nodeInterfaceSchema>;

/**
 * Relationship variant payloads (canonical CALM 1.2).
 * In the canonical form these live INSIDE the `relationship-type` object,
 * keyed by variant name — not as siblings of a string discriminant.
 */
const interactsVariantSchema = z.object({
  actor: z.string().min(1, 'Actor is required for interacts relationship'),
  nodes: z.array(z.string().min(1)).min(1, 'At least one node is required for interacts relationship'),
});

const connectsVariantSchema = z.object({
  source: nodeInterfaceSchema,
  destination: nodeInterfaceSchema,
});

const deployedInVariantSchema = z.object({
  container: z.string().min(1, 'Container is required for deployed-in relationship'),
  nodes: z.array(z.string().min(1)).min(1, 'At least one node is required for deployed-in relationship'),
});

const composedOfVariantSchema = z.object({
  container: z.string().min(1, 'Container is required for composed-of relationship'),
  nodes: z.array(z.string().min(1)).min(1, 'At least one node is required for composed-of relationship'),
});

/** The variant keys of a `relationship-type` object, in canonical order. */
export const RELATIONSHIP_VARIANT_KEYS = [
  'connects',
  'interacts',
  'deployed-in',
  'composed-of',
  'options',
] as const;

export type RelationshipVariant = (typeof RELATIONSHIP_VARIANT_KEYS)[number];

/**
 * Relationship Type (canonical NESTED form)
 * `relationship-type` is an object keyed by variant. CALM's spec uses `oneOf`,
 * so exactly one variant key must be present — enforced here via superRefine.
 * NOTE: this is intentionally stricter than the raw `oneOf` (it also rejects a
 * second, unknown variant key), which is the behaviour we want for authored docs.
 * `options` is kept loosely typed (`z.unknown()`) — a documented gap vs the
 * canonical `CalmDecisionSchema[]`; it is not exercised by CALMGuard.
 */
export const relationshipTypeSchema = z
  .object({
    connects: connectsVariantSchema.optional(),
    interacts: interactsVariantSchema.optional(),
    'deployed-in': deployedInVariantSchema.optional(),
    'composed-of': composedOfVariantSchema.optional(),
    options: z.unknown().optional(),
  })
  .superRefine((rt, ctx) => {
    const present = RELATIONSHIP_VARIANT_KEYS.filter(
      (k) => (rt as Record<string, unknown>)[k] !== undefined
    );
    if (present.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          present.length === 0
            ? 'relationship-type must contain exactly one variant (connects, interacts, deployed-in, composed-of, or options)'
            : `relationship-type must contain exactly one variant, but found ${present.length}: ${present.join(', ')}`,
      });
    }
  });

export type RelationshipType = z.infer<typeof relationshipTypeSchema>;

/**
 * Base Relationship Schema
 * Common properties carried at the relationship level — siblings of
 * `relationship-type`, never folded into the variant payload.
 */
const baseRelationshipSchema = z.object({
  'unique-id': z.string().min(1, 'Relationship unique-id is required'),
  description: z.string().optional(),
  protocol: protocolSchema.optional(),
  controls: z.record(z.string(), controlDefinitionSchema).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * CALM Relationship (canonical nested form)
 */
export const calmRelationshipSchema = baseRelationshipSchema.extend({
  'relationship-type': relationshipTypeSchema,
});

export type CalmRelationship = z.infer<typeof calmRelationshipSchema>;

/**
 * Returns the single variant present on a relationship's `relationship-type`.
 * Restores a switchable discriminant after moving from the flat discriminated
 * union to the nested object form. Mirrors `@calmstudio/calm-core` semantics.
 */
export function getRelationshipVariant(rel: CalmRelationship): RelationshipVariant {
  const rt = rel['relationship-type'];
  if (rt.connects !== undefined) return 'connects';
  if (rt.interacts !== undefined) return 'interacts';
  if (rt['deployed-in'] !== undefined) return 'deployed-in';
  if (rt['composed-of'] !== undefined) return 'composed-of';
  return 'options';
}

/**
 * Flow Transition
 * Represents a step in a business process flow
 */
export const flowTransitionSchema = z.object({
  'relationship-unique-id': z.string().min(1, 'Relationship unique-id is required for flow transition'),
  'sequence-number': z.number().int().positive('Sequence number must be a positive integer'),
  description: z.string().optional(),
  direction: z.enum(['source-to-destination', 'destination-to-source']).optional(),
});

export type FlowTransition = z.infer<typeof flowTransitionSchema>;

/**
 * CALM Flow
 * Represents a business process flow through the architecture
 */
export const calmFlowSchema = z.object({
  'unique-id': z.string().min(1, 'Flow unique-id is required'),
  name: z.string().min(1, 'Flow name is required'),
  description: z.string().min(1, 'Flow description is required'),
  transitions: z.array(flowTransitionSchema).min(1, 'Flow must have at least one transition'),
});

export type CalmFlow = z.infer<typeof calmFlowSchema>;

/**
 * CALM Document
 * Root schema for a complete CALM architecture definition.
 * Supports v1.1 core, v1.2 extra fields, and v1.0 legacy top-level fields.
 */
export const calmDocumentSchema = z.object({
  nodes: z.array(calmNodeSchema).min(1, 'Document must have at least one node'),
  relationships: z.array(calmRelationshipSchema),
  controls: z.record(z.string(), controlDefinitionSchema).optional(),
  flows: z.array(calmFlowSchema).optional(),
  // v1.2 additions — preserve without strict typing
  adrs: z.array(z.string()).optional(),
  decorators: z.unknown().optional(),
  timelines: z.unknown().optional(),
  // v1.0 legacy top-level fields — accept but don't require
  calmSchemaVersion: z.string().optional(),
  name: z.string().optional(),
});

export type CalmDocument = z.infer<typeof calmDocumentSchema>;
