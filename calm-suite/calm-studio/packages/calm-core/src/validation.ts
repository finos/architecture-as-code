// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * validation.ts — Shared CALM 1.2 architecture validation engine.
 *
 * Validates a CalmArchitecture object against:
 *   1. The FINOS CALM 1.2 meta-schema (vendored under `./schemas`)
 *      via Ajv (draft 2020-12).
 *   2. Semantic rules: dangling refs, duplicates, orphan nodes, self-loops.
 *   3. Info-level rules: nodes missing description.
 *
 * Shared between the studio (reactive store) and the MCP server. No Svelte
 * or browser dependencies — pure TypeScript.
 */

import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import type { CalmArchitecture, CalmRelationship } from './types.js';
import { getRelationshipVariant, getReferencedNodeIds } from './helpers.js';

import calmSchema from './schemas/calm.json' with { type: 'json' };
import coreSchema from './schemas/core.json' with { type: 'json' };
import controlSchema from './schemas/control.json' with { type: 'json' };
import controlRequirementSchema from './schemas/control-requirement.json' with { type: 'json' };
import interfaceSchema from './schemas/interface.json' with { type: 'json' };
import flowSchema from './schemas/flow.json' with { type: 'json' };
import evidenceSchema from './schemas/evidence.json' with { type: 'json' };
import unitsSchema from './schemas/units.json' with { type: 'json' };

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

// ─── Ajv setup (vendored CALM 1.2 meta-schemas) ──────────────────────────────

const ajv = new Ajv2020({ allErrors: true, strict: false, allowUnionTypes: true });
addFormats.default(ajv);
for (const s of [
	coreSchema,
	controlSchema,
	controlRequirementSchema,
	interfaceSchema,
	flowSchema,
	evidenceSchema,
	unitsSchema,
	calmSchema,
]) {
	ajv.addSchema(s as object);
}

/**
 * Returns the compiled CALM 1.2 root validator (`calm.json`).
 * Compiled lazily so dynamic-import + tree-shaking remain friendly.
 */
function getCalmValidator() {
	const v = ajv.getSchema((calmSchema as { $id?: string }).$id ?? '');
	if (!v) throw new Error('CALM 1.2 root schema not registered with Ajv');
	return v;
}

const validateSchema = getCalmValidator();

// ─── Main validation function ─────────────────────────────────────────────────

/**
 * Validate a CalmArchitecture and return all issues found.
 * Issues are sorted by severity: errors first, then warnings, then info.
 */
export function validateCalmArchitecture(arch: CalmArchitecture): ValidationIssue[] {
	const issues: ValidationIssue[] = [];

	// 1. JSON Schema validation against CALM 1.2 meta-schema
	const valid = validateSchema(arch);
	if (!valid && validateSchema.errors) {
		for (const err of validateSchema.errors) {
			issues.push(schemaErrorToIssue(err, arch));
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
	arch: CalmArchitecture,
): ValidationIssue {
	const path = err.instancePath;
	const message = err.message ?? 'Schema validation error';

	const nodeMatch = path.match(/^\/nodes\/(\d+)/);
	const relMatch = path.match(/^\/relationships\/(\d+)/);

	let nodeId: string | undefined;
	let relationshipId: string | undefined;

	if (nodeMatch) {
		const idx = parseInt(nodeMatch[1]!, 10);
		const node = arch.nodes?.[idx];
		if (node && node['unique-id']) nodeId = node['unique-id'];
	} else if (relMatch) {
		const idx = parseInt(relMatch[1]!, 10);
		const rel = arch.relationships?.[idx];
		if (rel && rel['unique-id']) relationshipId = rel['unique-id'];
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

	const archNodes = arch.nodes ?? [];
	const archRelationships = arch.relationships ?? [];

	// Duplicate node unique-ids
	const seenNodeIds = new Set<string>();
	for (const node of archNodes) {
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

	// Duplicate relationship unique-ids
	const seenRelIds = new Set<string>();
	for (const rel of archRelationships) {
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

	// Per-relationship rules
	const connectedNodeIds = new Set<string>();
	for (const rel of archRelationships) {
		issues.push(...validateRelationshipReferences(rel, nodeIds, connectedNodeIds));
	}

	// Per-node rules
	for (const node of archNodes) {
		const nodeId = node['unique-id'];
		if (nodeId && !connectedNodeIds.has(nodeId)) {
			issues.push({
				severity: 'warning',
				message: `Node "${nodeId}" is not referenced by any relationship`,
				nodeId,
			});
		}
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

/**
 * Per-relationship semantic checks. Handles all five nested variants.
 * Accumulates referenced node ids into `connectedNodeIds` for the
 * orphan-node check downstream.
 */
function validateRelationshipReferences(
	rel: CalmRelationship,
	nodeIds: Set<string>,
	connectedNodeIds: Set<string>,
): ValidationIssue[] {
	const issues: ValidationIssue[] = [];
	const relId = rel['unique-id'];
	const rt = rel['relationship-type'];
	if (!rt || typeof rt !== 'object') {
		issues.push({
			severity: 'error',
			message: `Relationship "${relId ?? '?'}" is missing relationship-type`,
			...(relId ? { relationshipId: relId } : {}),
		});
		return issues;
	}

	const variant = getRelationshipVariant(rt);
	const refs = getReferencedNodeIds(rel);
	for (const id of refs) connectedNodeIds.add(id);

	// Dangling-ref check (uniform across variants)
	if (nodeIds.size > 0) {
		for (const id of refs) {
			if (!nodeIds.has(id)) {
				issues.push({
					severity: 'error',
					message: `Relationship "${relId ?? '?'}" (${variant}) references unknown node "${id}"`,
					...(relId ? { relationshipId: relId } : {}),
				});
			}
		}
	}

	// Variant-specific structural checks
	if ('connects' in rt) {
		const c = rt.connects;
		if (!c.source?.node) {
			issues.push({
				severity: 'error',
				message: `Relationship "${relId ?? '?'}" (connects) is missing source.node`,
				...(relId ? { relationshipId: relId } : {}),
			});
		}
		if (!c.destination?.node) {
			issues.push({
				severity: 'error',
				message: `Relationship "${relId ?? '?'}" (connects) is missing destination.node`,
				...(relId ? { relationshipId: relId } : {}),
			});
		}
		if (c.source?.node && c.destination?.node && c.source.node === c.destination.node) {
			issues.push({
				severity: 'warning',
				message: `Relationship "${relId ?? '?'}" (connects) connects a node to itself`,
				...(relId ? { relationshipId: relId } : {}),
			});
		}
	} else if ('composed-of' in rt) {
		const co = rt['composed-of'];
		if (!co.container) {
			issues.push({
				severity: 'error',
				message: `Relationship "${relId ?? '?'}" (composed-of) is missing container`,
				...(relId ? { relationshipId: relId } : {}),
			});
		}
		if (!Array.isArray(co.nodes) || co.nodes.length === 0) {
			issues.push({
				severity: 'error',
				message: `Relationship "${relId ?? '?'}" (composed-of) must list at least one child node`,
				...(relId ? { relationshipId: relId } : {}),
			});
		}
	} else if ('interacts' in rt) {
		const i = rt.interacts;
		if (!i.actor) {
			issues.push({
				severity: 'error',
				message: `Relationship "${relId ?? '?'}" (interacts) is missing actor`,
				...(relId ? { relationshipId: relId } : {}),
			});
		}
		if (!Array.isArray(i.nodes) || i.nodes.length === 0) {
			issues.push({
				severity: 'error',
				message: `Relationship "${relId ?? '?'}" (interacts) must list at least one interacted node`,
				...(relId ? { relationshipId: relId } : {}),
			});
		}
	} else if ('deployed-in' in rt) {
		const d = rt['deployed-in'];
		if (!d.container) {
			issues.push({
				severity: 'error',
				message: `Relationship "${relId ?? '?'}" (deployed-in) is missing container`,
				...(relId ? { relationshipId: relId } : {}),
			});
		}
		if (!Array.isArray(d.nodes) || d.nodes.length === 0) {
			issues.push({
				severity: 'error',
				message: `Relationship "${relId ?? '?'}" (deployed-in) must list at least one deployed node`,
				...(relId ? { relationshipId: relId } : {}),
			});
		}
	}

	return issues;
}
