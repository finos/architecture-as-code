/**
 * Compile-time conformance against canonical `@finos/calm-models`.
 *
 * CALMGuard keeps its own Zod runtime validator, but its `relationship-type`
 * and `node-type` SHAPES must stay structurally aligned with the canonical
 * CALM model so documents round-trip cleanly to/from the other CALM tools
 * (CLI, Hub, Visualizer, Studio).
 *
 * IMPORTANT: this file is the gate, and the gate is `tsc --noEmit`
 * (`npm run typecheck`). It is deliberately NOT a `*.test.ts` — vitest strips
 * types via esbuild and would not catch drift. These assertions are type-level
 * only (the exported bindings have no runtime use). If CALMGuard's inferred
 * shape diverges from canonical, the typecheck fails here.
 *
 * Scope: only the shapes this migration changed — `relationship-type` (the
 * nested variant object) and `node-type`. We intentionally do NOT assert whole
 * `CalmRelationship`/`CalmNode`, because controls/flows/interfaces optionality
 * diverges and is out of scope for this change. `options` is excluded from the
 * relationship check: CALMGuard keeps it loosely typed (`unknown`) as a
 * documented gap vs canonical `CalmDecisionSchema[]`.
 */
import type { CalmRelationshipTypeSchema, CalmNodeTypeSchema } from '@finos/calm-models/types';
import type { RelationshipType, NodeType } from './types';

declare const calmguardRelType: RelationshipType;
declare const canonicalRelType: CalmRelationshipTypeSchema;
declare const calmguardNodeType: NodeType;
declare const canonicalNodeType: CalmNodeTypeSchema;

// node-type aligns in both directions (both are "any string", 9 well-known hints).
export const _nodeTypeToCanonical: CalmNodeTypeSchema = calmguardNodeType;
export const _nodeTypeFromCanonical: NodeType = canonicalNodeType;

// relationship-type variant object aligns in both directions for the four
// concrete variants (options omitted — documented gap).
export const _relTypeToCanonical: Omit<CalmRelationshipTypeSchema, 'options'> = calmguardRelType;
export const _relTypeFromCanonical: Omit<RelationshipType, 'options'> = canonicalRelType;
