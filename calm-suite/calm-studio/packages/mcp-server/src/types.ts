// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Interface schema
// ---------------------------------------------------------------------------

export const InterfaceInputSchema = z.object({
  'unique-id': z.string(),
  type: z.string(),
  value: z.string().optional()
});

// ---------------------------------------------------------------------------
// Node schema
// ---------------------------------------------------------------------------

export const NodeInputSchema = z.object({
  'unique-id': z.string(),
  'node-type': z.string(),
  name: z.string(),
  description: z.string().optional(),
  interfaces: z.array(InterfaceInputSchema).optional(),
  customMetadata: z.record(z.string(), z.string()).optional()
});

// ---------------------------------------------------------------------------
// Relationship schema (CALM 1.2 nested form)
// ---------------------------------------------------------------------------

const ConnectsEndpointSchema = z.object({
  node: z.string(),
  /**
   * Optional list of node-interface unique-ids the connection targets.
   * Mirrors `CalmNodeInterfaceSchema` in @finos/calm-models.
   */
  interfaces: z.array(z.string()).optional()
});

const ConnectsRelationshipSchema = z.object({
  source: ConnectsEndpointSchema,
  destination: ConnectsEndpointSchema
});

const ComposedOfRelationshipSchema = z.object({
  container: z.string(),
  nodes: z.array(z.string()).min(1)
});

const InteractsRelationshipSchema = z.object({
  actor: z.string(),
  nodes: z.array(z.string()).min(1)
});

const DeployedInRelationshipSchema = z.object({
  container: z.string(),
  nodes: z.array(z.string()).min(1)
});

/**
 * CALM 1.2 nested `relationship-type` discriminated union. Exactly one
 * variant key must be present per the FINOS meta-schema `oneOf`.
 */
export const RelationshipTypeSchema = z.union([
  z.object({ connects: ConnectsRelationshipSchema }).strict(),
  z.object({ 'composed-of': ComposedOfRelationshipSchema }).strict(),
  z.object({ interacts: InteractsRelationshipSchema }).strict(),
  z.object({ 'deployed-in': DeployedInRelationshipSchema }).strict(),
  z.object({ options: z.array(z.unknown()) }).strict()
]);

export const RelationshipInputSchema = z.object({
  'unique-id': z.string(),
  'relationship-type': RelationshipTypeSchema,
  protocol: z.string().optional(),
  description: z.string().optional()
});

// ---------------------------------------------------------------------------
// Tool input schemas
// ---------------------------------------------------------------------------

export const CreateArchitectureSchema = z.object({
  nodes: z.array(NodeInputSchema),
  relationships: z.array(RelationshipInputSchema).optional().default([]),
  /** Target .calm file path. Defaults to ./architecture.json if omitted. */
  file: z.string().optional()
});

export const AddNodeSchema = z.object({
  node: NodeInputSchema,
  file: z.string().optional()
});

export const AddRelationshipSchema = z.object({
  relationship: RelationshipInputSchema,
  file: z.string().optional()
});

export const ValidateArchitectureSchema = z.object({
  file: z.string().optional()
});

export const RenderDiagramSchema = z.object({
  file: z.string().optional(),
  /** Layout direction. Defaults to DOWN. */
  direction: z.enum(['DOWN', 'RIGHT', 'UP']).optional().default('DOWN')
});

export const ExportCalmSchema = z.object({
  /** Source .calm file path. Defaults to ./architecture.json if omitted. */
  source: z.string().optional(),
  destination: z.string()
});

export const ImportCalmSchema = z.object({
  file: z.string()
});

export const DescribeArchitectureSchema = z.object({
  file: z.string().optional()
});

export const GetNodeSchema = z.object({
  id: z.string(),
  file: z.string().optional()
});

export const UpdateNodeSchema = z.object({
  id: z.string(),
  updates: NodeInputSchema.omit({ 'unique-id': true }).partial(),
  file: z.string().optional()
});

export const DeleteNodeSchema = z.object({
  id: z.string(),
  file: z.string().optional()
});

export const QueryNodesSchema = z.object({
  type: z.string().optional(),
  name: z.string().optional(),
  file: z.string().optional()
});

export const BatchCreateNodesSchema = z.object({
  nodes: z.array(NodeInputSchema),
  file: z.string().optional()
});

export const GetRelationshipSchema = z.object({
  id: z.string(),
  file: z.string().optional()
});

export const UpdateRelationshipSchema = z.object({
  id: z.string(),
  updates: RelationshipInputSchema.omit({ 'unique-id': true }).partial(),
  file: z.string().optional()
});

export const DeleteRelationshipSchema = z.object({
  id: z.string(),
  file: z.string().optional()
});

export const FinalizeArchitectureSchema = z.object({
  file: z.string().optional(),
  /** Render SVG and include in the response. Defaults to true. */
  render: z.boolean().optional().default(true)
});

export const CreateViewSchema = z.object({
  file: z.string().optional()
});

export const UpdateViewSchema = z.object({
  file: z.string().optional()
});

// ---------------------------------------------------------------------------
// Decorator tool input schemas (#2551)
// ---------------------------------------------------------------------------

export const GetDecoratorsSchema = z.object({
  file: z.string().optional(),
  /** Optional decorator-type filter (e.g. 'threat-model', 'control-catalog'). */
  type: z.string().optional()
});

export const GetDecoratorsForNodeSchema = z.object({
  file: z.string().optional(),
  /** unique-id of the node to look up. */
  nodeId: z.string()
});

export const GetThreatsForNodeSchema = z.object({
  file: z.string().optional(),
  nodeId: z.string()
});

export const GetControlSchema = z.object({
  file: z.string().optional(),
  /** Control id (e.g. C8). */
  controlId: z.string()
});

const ThreatInputSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  mitigations: z.string(),
  controls: z.array(z.string()),
  'affected-nodes': z.array(z.string()).optional(),
  section: z.string().optional(),
  'affected-layers': z.array(z.string()).optional()
});

export const AddThreatDecoratorSchema = z.object({
  file: z.string().optional(),
  /** Target arch file ref(s) — written into the decorator's `target` array. */
  targetFiles: z.array(z.string()).min(1).optional(),
  decorator: z.object({
    'unique-id': z.string(),
    type: z.literal('threat-model'),
    target: z.array(z.string()).min(1).optional(),
    'applies-to': z.array(z.string()).min(1),
    data: z.object({
      threats: z.array(ThreatInputSchema).min(1),
      layer: z.string().optional(),
      framework: z.string().optional(),
      version: z.string().optional()
    })
  })
});

// ---------------------------------------------------------------------------
// MCP response helpers
// ---------------------------------------------------------------------------

export type ToolContent = { type: 'text'; text: string };
export type ToolResponse = { content: ToolContent[]; isError: boolean };

export function toolSuccess(text: string): ToolResponse {
  return { content: [{ type: 'text', text }], isError: false };
}

export function toolError(text: string): ToolResponse {
  return { content: [{ type: 'text', text }], isError: true };
}
