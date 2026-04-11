// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

/**
 * The 9 built-in CALM node types. Custom types are represented as plain strings.
 */
export type CalmNodeType =
  | 'actor'
  | 'system'
  | 'service'
  | 'database'
  | 'network'
  | 'webclient'
  | 'ecosystem'
  | 'ldap'
  | 'data-asset';

/**
 * The 5 CALM relationship types.
 */
export type CalmRelationshipType =
  | 'connects'
  | 'interacts'
  | 'deployed-in'
  | 'composed-of'
  | 'options';

/**
 * A typed interface (endpoint) attached to a CALM node.
 * Represents things like URLs, host-port pairs, container images, etc.
 */
export interface CalmInterface {
  'unique-id': string;
  /** e.g. 'url', 'host-port', 'container-image', 'port' */
  type: string;
  value?: string;
}

/**
 * A single control requirement linking to an external requirement URL.
 * Per CALM 1.2 control.json schema — requirement-url is required; config-url and config are optional.
 */
export interface CalmControlRequirement {
  'requirement-url': string;
  'config-url'?: string;
  config?: Record<string, unknown>;
}

/**
 * A control applied to a node or relationship.
 * Keys in CalmControls use kebab-case identifiers (e.g. 'aigf-data-leakage-prevention').
 */
export interface CalmControl {
  description: string;
  requirements: CalmControlRequirement[];
}

/**
 * A map of control key to control detail, applied to nodes or relationships.
 * Keys follow kebab-case convention (e.g. 'aigf-firewalling-filtering').
 */
export type CalmControls = Record<string, CalmControl>;

/**
 * A CALM 1.2 decorator — architecture-wide overlay for cross-cutting concerns
 * such as AIGF governance summaries, regulatory mappings, or security posture.
 * Read by CalmGuard for reporting.
 */
export interface CalmDecorator {
  'unique-id': string;
  type: string;
  target: string[];
  'applies-to': string[];
  data: Record<string, unknown>;
}

/**
 * CALM 1.2 evidence — links a control to evidence of compliance.
 * Evidence collection/linking is CalmGuard's responsibility at build/runtime.
 * CalmStudio supports this type for roundtrip completeness only.
 */
export interface CalmEvidence {
  'unique-id': string;
  'evidence-paths': string[];
  'control-config-url': string;
}

/**
 * A node in the CALM architecture graph.
 * Corresponds to services, databases, actors, and other system components.
 */
export interface CalmNode {
  'unique-id': string;
  /** node-type is CalmNodeType for built-in types; plain string allows custom types */
  'node-type': CalmNodeType | string;
  name: string;
  description?: string;
  interfaces?: CalmInterface[];
  /** Arbitrary key-value metadata for extension without schema changes */
  customMetadata?: Record<string, string>;
  /** CALM 1.2 controls applied to this node */
  controls?: CalmControls;
  /** Data classification label (e.g. 'PII', 'Confidential', 'Public') */
  'data-classification'?: string;
  /** Arbitrary structured metadata for extension */
  metadata?: Record<string, unknown>;
}

/**
 * A directed relationship between two CALM nodes.
 */
export interface CalmRelationship {
  'unique-id': string;
  'relationship-type': CalmRelationshipType;
  /** unique-id of the source node */
  source: string;
  /** unique-id of the destination node */
  destination: string;
  /** e.g. 'HTTPS', 'JDBC', 'gRPC' */
  protocol?: string;
  description?: string;
  /** CALM 1.2 controls applied to this relationship */
  controls?: CalmControls;
  /** Arbitrary structured metadata for extension */
  metadata?: Record<string, unknown>;
}

/**
 * A single step in a CALM flow sequence, referencing a relationship.
 * Corresponds to CALM 1.2 flow.json transition schema.
 */
export interface CalmTransition {
  /** unique-id of the relationship this step traverses */
  'relationship-unique-id': string;
  /** 1-based ordering within the flow */
  'sequence-number': number;
  /** Human-readable description of what this step does */
  summary: string;
  /** Optional — explicit direction override for bidirectional relationships */
  direction?: 'source-to-destination' | 'destination-to-source';
}

/**
 * A named sequence of transitions describing a runtime flow through the architecture.
 * Corresponds to CALM 1.2 flow.json schema.
 */
export interface CalmFlow {
  'unique-id': string;
  name: string;
  description: string;
  'requirement-url'?: string;
  transitions: CalmTransition[];
  controls?: CalmControls;
  metadata?: Record<string, unknown>[];
}

/**
 * A complete CALM architecture document — nodes + relationships.
 */
export interface CalmArchitecture {
  nodes: CalmNode[];
  relationships: CalmRelationship[];
  /** CALM 1.2 decorators — architecture-wide overlays for governance and cross-cutting concerns */
  decorators?: CalmDecorator[];
  /** CALM 1.2 flows — named sequences of transitions describing runtime behaviour */
  flows?: CalmFlow[];
}
