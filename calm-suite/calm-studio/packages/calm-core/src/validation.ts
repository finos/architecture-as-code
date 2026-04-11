// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * validation.ts — Shared Ajv-based CALM architecture validation engine.
 *
 * Validates a CalmArchitecture object against:
 *   1. A JSON Schema that matches CalmStudio's internal model format
 *   2. Semantic rules: dangling refs, duplicates, orphan nodes, self-loops
 *   3. Info-level rules: nodes missing description
 *
 * This module is shared between the studio (reactive store) and the MCP server.
 * It has no Svelte or browser dependencies — pure TypeScript.
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { CalmArchitecture } from './types.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ValidationIssue {
	severity: 'error' | 'warning' | 'info';
	message: string;
	/** unique-id of the node involved, if applicable */
	nodeId?: string;
	/** unique-id of the relationship involved, if applicable */
	relationshipId?: string;
	/** JSON path or schema path context */
	path?: string;
}

// ─── JSON Schema (CalmStudio internal format) ─────────────────────────────────

/**
 * JSON Schema for CalmStudio's flat internal format.
 * Note: This is NOT the FINOS meta-schema (which uses nested relationship-type objects).
 * CalmStudio uses a simpler flat format: relationship-type is a plain string.
 */
const calmStudioSchema = {
	$id: 'https://calmstudio.io/internal/architecture',
	type: 'object',
	required: ['nodes', 'relationships'],
	properties: {
		nodes: {
			type: 'array',
			items: {
				type: 'object',
				required: ['unique-id', 'node-type', 'name'],
				properties: {
					'unique-id': { type: 'string', minLength: 1 },
					'node-type': { type: 'string', minLength: 1 },
					name: { type: 'string', minLength: 1 },
					description: { type: 'string' },
					interfaces: { type: 'array' },
					customMetadata: { type: 'object' },
				},
				additionalProperties: true,
			},
		},
		relationships: {
			type: 'array',
			items: {
				type: 'object',
				required: ['unique-id', 'relationship-type', 'source', 'destination'],
				properties: {
					'unique-id': { type: 'string', minLength: 1 },
					'relationship-type': { type: 'string', minLength: 1 },
					source: { type: 'string', minLength: 1 },
					destination: { type: 'string', minLength: 1 },
					protocol: { type: 'string' },
					description: { type: 'string' },
				},
				additionalProperties: true,
			},
		},
	},
	additionalProperties: true,
};

// ─── Ajv setup ────────────────────────────────────────────────────────────────

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const validateSchema = ajv.compile(calmStudioSchema);

// ─── Main validation function ─────────────────────────────────────────────────

/**
 * Validate a CalmArchitecture and return all issues found.
 * Issues are sorted by severity: errors first, then warnings, then info.
 */
export function validateCalmArchitecture(arch: CalmArchitecture): ValidationIssue[] {
	const issues: ValidationIssue[] = [];

	// 1. JSON Schema validation
	const valid = validateSchema(arch);
	if (!valid && validateSchema.errors) {
		for (const err of validateSchema.errors) {
			const issue = schemaErrorToIssue(err, arch);
			issues.push(issue);
		}
	}

	// 2. Semantic validation (only if basic structure is valid enough to traverse)
	if (Array.isArray(arch.nodes) && Array.isArray(arch.relationships)) {
		issues.push(...runSemanticRules(arch));
	}

	// Sort: errors first, then warnings, then info
	const severityOrder = { error: 0, warning: 1, info: 2 };
	issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

	return issues;
}

// ─── Schema error → ValidationIssue ──────────────────────────────────────────

function schemaErrorToIssue(
	err: { instancePath: string; message?: string; keyword?: string },
	arch: CalmArchitecture
): ValidationIssue {
	const path = err.instancePath;
	const message = err.message ?? 'Schema validation error';

	// Try to extract nodeId or relationshipId from the path
	const nodeMatch = path.match(/^\/nodes\/(\d+)/);
	const relMatch = path.match(/^\/relationships\/(\d+)/);

	let nodeId: string | undefined;
	let relationshipId: string | undefined;

	if (nodeMatch) {
		const idx = parseInt(nodeMatch[1]!, 10);
		const node = arch.nodes[idx];
		if (node && node['unique-id']) {
			nodeId = node['unique-id'];
		}
	} else if (relMatch) {
		const idx = parseInt(relMatch[1]!, 10);
		const rel = arch.relationships[idx];
		if (rel && rel['unique-id']) {
			relationshipId = rel['unique-id'];
		}
	}

	return {
		severity: 'error',
		message: path ? `${path}: ${message}` : message,
		...(nodeId !== undefined ? { nodeId } : {}),
		...(relationshipId !== undefined ? { relationshipId } : {}),
		path,
	};
}

// ─── Semantic rules ───────────────────────────────────────────────────────────

function runSemanticRules(arch: CalmArchitecture): ValidationIssue[] {
	const issues: ValidationIssue[] = [];
	const nodeIds = new Set<string>();

	// ── Duplicate node unique-ids ─────────────────────────────────────────────
	const seenNodeIds = new Set<string>();
	for (const node of arch.nodes) {
		if (!node['unique-id']) continue;
		if (seenNodeIds.has(node['unique-id'])) {
			issues.push({
				severity: 'error',
				message: `Duplicate node unique-id: "${node['unique-id']}"`,
				nodeId: node['unique-id'],
			});
		} else {
			seenNodeIds.add(node['unique-id']);
			nodeIds.add(node['unique-id']);
		}
	}

	// ── Duplicate relationship unique-ids ─────────────────────────────────────
	const seenRelIds = new Set<string>();
	for (const rel of arch.relationships) {
		if (!rel['unique-id']) continue;
		if (seenRelIds.has(rel['unique-id'])) {
			issues.push({
				severity: 'error',
				message: `Duplicate relationship unique-id: "${rel['unique-id']}"`,
				relationshipId: rel['unique-id'],
			});
		} else {
			seenRelIds.add(rel['unique-id']);
		}
	}

	// ── Per-relationship rules ─────────────────────────────────────────────────
	const connectedNodeIds = new Set<string>();

	for (const rel of arch.relationships) {
		const relId = rel['unique-id'];

		// Missing source/destination (already covered by schema, but semantic gives better messages)
		if (!rel.source) {
			issues.push({
				severity: 'error',
				message: `Relationship "${relId ?? '?'}" is missing a source node`,
				...(relId ? { relationshipId: relId } : {}),
			});
		} else {
			connectedNodeIds.add(rel.source);
			// Dangling source reference
			if (nodeIds.size > 0 && !nodeIds.has(rel.source)) {
				issues.push({
					severity: 'error',
					message: `Relationship "${relId ?? '?'}" source "${rel.source}" does not reference a known node`,
					...(relId ? { relationshipId: relId } : {}),
				});
			}
		}

		if (!rel.destination) {
			issues.push({
				severity: 'error',
				message: `Relationship "${relId ?? '?'}" is missing a destination node`,
				...(relId ? { relationshipId: relId } : {}),
			});
		} else {
			connectedNodeIds.add(rel.destination);
			// Dangling destination reference
			if (nodeIds.size > 0 && !nodeIds.has(rel.destination)) {
				issues.push({
					severity: 'error',
					message: `Relationship "${relId ?? '?'}" destination "${rel.destination}" does not reference a known node`,
					...(relId ? { relationshipId: relId } : {}),
				});
			}
		}

		// Self-loop
		if (rel.source && rel.destination && rel.source === rel.destination) {
			issues.push({
				severity: 'warning',
				message: `Relationship "${relId ?? '?'}" connects a node to itself (source === destination)`,
				...(relId ? { relationshipId: relId } : {}),
			});
		}
	}

	// ── Per-node rules ────────────────────────────────────────────────────────
	for (const node of arch.nodes) {
		const nodeId = node['unique-id'];

		// Orphan node: in the arch but not referenced by any relationship
		if (nodeId && !connectedNodeIds.has(nodeId)) {
			issues.push({
				severity: 'warning',
				message: `Node "${nodeId}" is not referenced by any relationship`,
				nodeId,
			});
		}

		// Info: missing description
		if (nodeId && (!node.description || node.description.trim() === '')) {
			issues.push({
				severity: 'info',
				message: `Node "${nodeId}" has no description`,
				nodeId,
			});
		}
	}

	return issues;
}
