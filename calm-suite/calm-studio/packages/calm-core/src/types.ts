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
 * The 5 CALM relationship variant keys. Used as discriminator in the nested
 * `relationship-type` object and as a flat identifier for routing/UI code.
 */
export type CalmRelationshipVariant =
  | 'connects'
  | 'interacts'
  | 'deployed-in'
  | 'composed-of'
  | 'options';

/**
 * Source/destination endpoint reference inside a `connects` relationship.
 * CALM 1.2 wraps node refs in an object to allow future extension
 * (e.g. interface refs alongside node refs).
 */
export interface CalmConnectsEndpoint {
  /** unique-id of the referenced node */
  node: string;
}

export interface CalmConnectsRelationship {
  source: CalmConnectsEndpoint;
  destination: CalmConnectsEndpoint;
}

export interface CalmComposedOfRelationship {
  /** unique-id of the container node */
  container: string;
  /** unique-ids of the contained nodes (min 1 per spec) */
  nodes: string[];
}

export interface CalmInteractsRelationship {
  /** unique-id of the actor node */
  actor: string;
  /** unique-ids of nodes the actor interacts with (min 1 per spec) */
  nodes: string[];
}

export interface CalmDeployedInRelationship {
  /** unique-id of the deployment container */
  container: string;
  /** unique-ids of the deployed nodes (min 1 per spec) */
  nodes: string[];
}

/**
 * CALM 1.2 nested `relationship-type` discriminated union. Exactly one
 * variant key is present (enforced by meta-schema `oneOf`).
 */
export type CalmRelationshipType =
  | { connects: CalmConnectsRelationship }
  | { 'composed-of': CalmComposedOfRelationship }
  | { interacts: CalmInteractsRelationship }
  | { 'deployed-in': CalmDeployedInRelationship }
  | { options: unknown[] };

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
 * A relationship between CALM elements. Per CALM 1.2 meta-schema, the
 * `relationship-type` field is a nested object whose single key identifies
 * the variant (`connects`, `composed-of`, `interacts`, `deployed-in`,
 * `options`). Source/destination/container/actor/nodes live inside the
 * variant object, not at the top level — there is no top-level
 * `source`/`destination` on this interface.
 *
 * For pre-1.2 / legacy / flat producers see `legacyToCalmRelationship` in
 * `legacy.ts` (added in a follow-up commit if cross-version compatibility
 * is required).
 */
export interface CalmRelationship {
  'unique-id': string;
  'relationship-type': CalmRelationshipType;
  /** e.g. 'HTTPS', 'JDBC', 'gRPC' — applies primarily to `connects` */
  protocol?: string;
  description?: string;
  /** CALM 1.2 controls applied to this relationship */
  controls?: CalmControls;
  /** Arbitrary structured metadata for extension */
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Relationship-type accessor helpers
// ---------------------------------------------------------------------------

/**
 * Return the variant key actually present on a nested relationship-type.
 * Useful for switching without exhaustively probing each variant.
 */
export function getRelationshipVariant(
  rt: CalmRelationshipType,
): CalmRelationshipVariant {
  if ('connects' in rt) return 'connects';
  if ('composed-of' in rt) return 'composed-of';
  if ('interacts' in rt) return 'interacts';
  if ('deployed-in' in rt) return 'deployed-in';
  return 'options';
}

/**
 * Best-effort extraction of source/destination node ids from any
 * relationship variant. Returns `null` for either side when the variant
 * doesn't have a single-source or single-destination concept (composed-of,
 * deployed-in, interacts produce multi-node payloads on the destination
 * side; treat them via dedicated accessors).
 */
export function getConnectsEndpoints(
  rel: CalmRelationship,
): { source: string; destination: string } | null {
  const rt = rel['relationship-type'];
  if ('connects' in rt) {
    return { source: rt.connects.source.node, destination: rt.connects.destination.node };
  }
  return null;
}

/**
 * Return container + child-node ids for composed-of / deployed-in variants.
 * `null` otherwise.
 */
export function getContainerAndNodes(
  rel: CalmRelationship,
): { container: string; nodes: string[] } | null {
  const rt = rel['relationship-type'];
  if ('composed-of' in rt) return { container: rt['composed-of'].container, nodes: rt['composed-of'].nodes };
  if ('deployed-in' in rt) return { container: rt['deployed-in'].container, nodes: rt['deployed-in'].nodes };
  return null;
}

/**
 * Return actor + interacted-with node ids for the interacts variant. `null`
 * otherwise.
 */
export function getActorAndNodes(
  rel: CalmRelationship,
): { actor: string; nodes: string[] } | null {
  const rt = rel['relationship-type'];
  if ('interacts' in rt) return { actor: rt.interacts.actor, nodes: rt.interacts.nodes };
  return null;
}

/**
 * Flatten any nested relationship to the set of node unique-ids it
 * references. Used by validation/graph-traversal code that doesn't care
 * about direction. Returns the union of all node refs in the variant.
 */
export function getReferencedNodeIds(rel: CalmRelationship): string[] {
  const rt = rel['relationship-type'];
  if ('connects' in rt) {
    const out: string[] = [];
    if (rt.connects?.source?.node) out.push(rt.connects.source.node);
    if (rt.connects?.destination?.node) out.push(rt.connects.destination.node);
    return out;
  }
  if ('composed-of' in rt) {
    const co = rt['composed-of'];
    const out: string[] = [];
    if (co?.container) out.push(co.container);
    if (Array.isArray(co?.nodes)) out.push(...co.nodes);
    return out;
  }
  if ('deployed-in' in rt) {
    const d = rt['deployed-in'];
    const out: string[] = [];
    if (d?.container) out.push(d.container);
    if (Array.isArray(d?.nodes)) out.push(...d.nodes);
    return out;
  }
  if ('interacts' in rt) {
    const i = rt.interacts;
    const out: string[] = [];
    if (i?.actor) out.push(i.actor);
    if (Array.isArray(i?.nodes)) out.push(...i.nodes);
    return out;
  }
  return [];
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
