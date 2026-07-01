// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

/**
 * validation.ts — Thin re-export wrapper around the shared calm-core validation engine.
 *
 * All validation logic now lives in @calmstudio/calm-core to ensure the MCP server
 * and the studio produce identical validation results for the same architecture.
 *
 * Previous hand-rolled validation rules have been migrated to calm-core (Plan 00).
 */

export { validateCalmArchitecture as validateArchitecture } from '@calmstudio/calm-core';
export type { ValidationIssue } from '@calmstudio/calm-core';

// Re-export CALM types that other mcp-server files import from here
export type { CalmArchitecture, CalmNode, CalmRelationship } from '@calmstudio/calm-core';
