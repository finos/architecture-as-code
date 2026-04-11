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
// Relationship schema
// ---------------------------------------------------------------------------

export const RelationshipInputSchema = z.object({
  'unique-id': z.string(),
  'relationship-type': z.enum(['connects', 'interacts', 'deployed-in', 'composed-of', 'options']),
  source: z.string(),
  destination: z.string(),
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

export const CreateViewSchema = z.object({
  file: z.string().optional()
});

export const UpdateViewSchema = z.object({
  file: z.string().optional()
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
