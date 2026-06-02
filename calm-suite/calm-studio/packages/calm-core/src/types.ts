// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

/**
 * types.ts — Canonical CALM type re-exports from @finos/calm-models with
 * backwards-compatible aliases for CalmStudio consumers.
 *
 * Per https://github.com/finos/architecture-as-code/pull/2553 review:
 * calm-studio reuses the canonical types maintained in calm-models rather
 * than maintaining a parallel vendored copy. Schema drift and feature drift
 * (e.g. interface-level endpoint refs on connects relationships) are
 * eliminated by depending on calm-models directly.
 *
 * Calm-studio-specific extensions (decorators, evidence) stay local because
 * calm-models does not define them yet. Variant accessor helpers live in
 * helpers.ts.
 */

export type {
  CalmNodeSchema as CalmNode,
  CalmNodeTypeSchema as CalmNodeType,
  CalmInterfaceSchema as CalmInterface,
  CalmRelationshipSchema as CalmRelationship,
  CalmRelationshipTypeSchema as CalmRelationshipType,
  CalmConnectsRelationshipSchema as CalmConnectsRelationship,
  CalmComposedOfRelationshipSchema as CalmComposedOfRelationship,
  CalmInteractsRelationshipSchema as CalmInteractsRelationship,
  CalmDeployedInRelationshipSchema as CalmDeployedInRelationship,
  CalmOptionsRelationshipSchema as CalmOptionsRelationship,
  CalmDecisionSchema as CalmDecision,
  CalmProtocolSchema as CalmProtocol,
  CalmArchitectureSchema as CalmArchitecture,
  CalmCoreSchema as CalmCore,
  CalmControlsSchema as CalmControls,
  CalmControlSchema as CalmControl,
  CalmControlDetailSchema as CalmControlRequirement,
  CalmMetadataSchema as CalmMetadata,
  CalmFlowSchema as CalmFlow,
  CalmFlowTransitionSchema as CalmTransition,
  CalmFlowTransitionDirectionSchema,
} from '@finos/calm-models/types';

import type { CalmNodeInterfaceSchema } from '@finos/calm-models/types';

/**
 * Backwards-compatible alias. Per calm-models the connects-endpoint shape
 * is `{ node: string; interfaces?: string[] }` (interfaces refer to
 * unique-ids of CalmInterface{Type,Definition}Schema). PR #2553 originally
 * dropped the `interfaces` field; the alias restores it.
 */
export type CalmConnectsEndpoint = CalmNodeInterfaceSchema;

/**
 * Variant key alias — string literal union for routing/UI code that
 * doesn't need the full discriminated payload.
 */
export type CalmRelationshipVariant =
  | 'connects'
  | 'interacts'
  | 'deployed-in'
  | 'composed-of'
  | 'options';

// ─── CalmStudio-only extensions (not in calm-models) ────────────────────────

/**
 * A CALM 1.2 decorator — architecture-wide overlay for cross-cutting concerns
 * such as AIGF governance summaries, regulatory mappings, threat models, or
 * security posture. Not yet in @finos/calm-models; lives locally until
 * upstreamed.
 */
export interface CalmDecorator {
  'unique-id': string;
  type: string;
  target: string[];
  'applies-to': string[];
  data: Record<string, unknown>;
}

/**
 * CALM 1.2 evidence — links a control to evidence of compliance. Studio
 * supports the type for round-trip completeness only.
 */
export interface CalmEvidence {
  'unique-id': string;
  'evidence-paths': string[];
  'control-config-url': string;
}
