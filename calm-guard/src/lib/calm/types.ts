import { z } from 'zod';

/**
 * CALM Schema Version
 * Reference: FINOS CALM v1.1
 */
export const CALM_SCHEMA_VERSION = '1.1';

/**
 * CALM Version type — supported schema versions
 * Re-exported from normalizer for convenience
 */
export type { CalmVersion } from './normalizer';

/**
 * Node Types
 * All 9 node types supported in CALM v1.1
 */
export const nodeTypeSchema = z.enum([
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
 * Base Relationship Schema
 * Common properties for all relationship types
 */
const baseRelationshipSchema = z.object({
  'unique-id': z.string().min(1, 'Relationship unique-id is required'),
  description: z.string().optional(),
  protocol: protocolSchema.optional(),
  controls: z.record(z.string(), controlDefinitionSchema).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Interacts Relationship
 * Represents an actor interacting with one or more nodes
 */
const interactsSchema = baseRelationshipSchema.extend({
  'relationship-type': z.literal('interacts'),
  interacts: z.object({
    actor: z.string().min(1, 'Actor is required for interacts relationship'),
    nodes: z.array(z.string().min(1)).min(1, 'At least one node is required for interacts relationship'),
  }),
});

/**
 * Connects Relationship
 * Represents a connection between two nodes
 */
const connectsSchema = baseRelationshipSchema.extend({
  'relationship-type': z.literal('connects'),
  connects: z.object({
    source: nodeInterfaceSchema,
    destination: nodeInterfaceSchema,
  }),
});

/**
 * Deployed-In Relationship
 * Represents nodes deployed within a container node
 */
const deployedInSchema = baseRelationshipSchema.extend({
  'relationship-type': z.literal('deployed-in'),
  'deployed-in': z.object({
    container: z.string().min(1, 'Container is required for deployed-in relationship'),
    nodes: z.array(z.string().min(1)).min(1, 'At least one node is required for deployed-in relationship'),
  }),
});

/**
 * Composed-Of Relationship
 * Represents a container node composed of other nodes
 */
const composedOfSchema = baseRelationshipSchema.extend({
  'relationship-type': z.literal('composed-of'),
  'composed-of': z.object({
    container: z.string().min(1, 'Container is required for composed-of relationship'),
    nodes: z.array(z.string().min(1)).min(1, 'At least one node is required for composed-of relationship'),
  }),
});

/**
 * Options Relationship
 * Structure TBD per CALM specification - using unknown for flexibility
 */
const optionsSchema = baseRelationshipSchema.extend({
  'relationship-type': z.literal('options'),
  options: z.unknown(),
});

/**
 * CALM Relationship
 * Discriminated union of all relationship types
 */
export const calmRelationshipSchema = z.discriminatedUnion('relationship-type', [
  interactsSchema,
  connectsSchema,
  deployedInSchema,
  composedOfSchema,
  optionsSchema,
]);

export type CalmRelationship = z.infer<typeof calmRelationshipSchema>;

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
