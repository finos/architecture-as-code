// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * archimate/rules.ts — ArchiMate domain validation for CalmStudio.
 *
 * Applies calm-archimate-extension.schema.json to nodes with `archimate:*`
 * node-types and to relationships that link ArchiMate nodes.
 */

import type { ValidateFunction } from 'ajv';
import type { CalmArchitecture, CalmNode, CalmRelationship } from '../types.js';
import type { ValidationIssue } from '../validation.js';
import { getReferencedNodeIds, getRelationshipVariant } from '../helpers.js';
import { expectedCalmVariantForArchimateRelationship } from './mapping.js';

export const ARCHIMATE_NODE_TYPE_PREFIX = 'archimate:';

export const ARCHIMATE_SCHEMA_ID =
	'https://calm.finos.org/extensions/archimate/calm-archimate-extension.schema.json';

/**
 * Normalize legacy ArchiMate element values to `archimate:{camelCase}`.
 * Accepts PascalCase (`ApplicationService`), prefixed PascalCase
 * (`archimate:ApplicationService`), or canonical pack IDs (`archimate:applicationService`).
 */
export function normalizeArchimateElementId(value: string): string | null {
	if (!value) return null;

	if (value.startsWith(ARCHIMATE_NODE_TYPE_PREFIX)) {
		const suffix = value.slice(ARCHIMATE_NODE_TYPE_PREFIX.length);
		if (!suffix) return null;
		return `${ARCHIMATE_NODE_TYPE_PREFIX}${suffix.charAt(0).toLowerCase()}${suffix.slice(1)}`;
	}

	if (/^[A-Z]/.test(value)) {
		return `${ARCHIMATE_NODE_TYPE_PREFIX}${value.charAt(0).toLowerCase()}${value.slice(1)}`;
	}

	return null;
}

/** @deprecated Use direct node-type match; kept for migration tooling. */
export function archimateNodeTypeToElement(nodeType: string): string | null {
	return normalizeArchimateElementId(nodeType);
}

export function isArchimateNode(node: CalmNode): boolean {
	const nodeType = node['node-type'];
	return typeof nodeType === 'string' && nodeType.startsWith(ARCHIMATE_NODE_TYPE_PREFIX);
}

function ajvErrorsToIssues(
	errors: NonNullable<ValidateFunction['errors']>,
	prefix: string,
	context: { nodeId?: string; relationshipId?: string; path?: string },
): ValidationIssue[] {
	return errors.map((err) => {
		const location = err.instancePath ? `${err.instancePath}: ` : '';
		return {
			severity: 'error',
			message: `[archimate] ${prefix}${location}${err.message ?? 'Schema validation error'}`,
			...(context.nodeId !== undefined ? { nodeId: context.nodeId } : {}),
			...(context.relationshipId !== undefined ? { relationshipId: context.relationshipId } : {}),
			...(context.path !== undefined ? { path: context.path } : {}),
		};
	});
}

function validateArchimateNodeMetadata(
	node: CalmNode,
	validateNodeMetadata: ValidateFunction,
): ValidationIssue[] {
	const nodeId = node['unique-id'];
	const metadata = node.metadata;

	if (!metadata || typeof metadata !== 'object') {
		return [
			{
				severity: 'error',
				message: `[archimate-001] ArchiMate node "${node.name}" (${node['node-type']}) is missing metadata (owner, archimate layer/element/viewpoint required)`,
				...(nodeId ? { nodeId } : {}),
			},
		];
	}

	if (!validateNodeMetadata(metadata)) {
		return ajvErrorsToIssues(validateNodeMetadata.errors ?? [], 'Node metadata: ', {
			...(nodeId ? { nodeId } : {}),
			path: '/metadata',
		});
	}

	const archimate = (metadata as Record<string, unknown>).archimate;
	if (!archimate || typeof archimate !== 'object') {
		return [
			{
				severity: 'error',
				message: `[archimate-001] ArchiMate node "${node.name}" (${node['node-type']}) is missing metadata.archimate`,
				...(nodeId ? { nodeId } : {}),
			},
		];
	}

	const nodeType = String(node['node-type']);
	if (nodeType.startsWith(ARCHIMATE_NODE_TYPE_PREFIX)) {
		const actualElement = (archimate as Record<string, unknown>).element;
		if (actualElement !== nodeType) {
			return [
				{
					severity: 'error',
					message: `[archimate-002] Node "${node.name}": node-type "${nodeType}" requires metadata.archimate.element "${nodeType}", but got "${String(actualElement)}"`,
					...(nodeId ? { nodeId } : {}),
				},
			];
		}
	}

	return [];
}

function relationshipTouchesArchimate(
	rel: CalmRelationship,
	archimateNodeIds: Set<string>,
): boolean {
	const rt = rel['relationship-type'];
	if (!rt || typeof rt !== 'object') return false;
	return getReferencedNodeIds(rel).some((id) => archimateNodeIds.has(id));
}

function validateArchimateRelationshipMetadata(
	rel: CalmRelationship,
	validateRelationshipMetadata: ValidateFunction,
): ValidationIssue[] {
	const relId = rel['unique-id'];
	const metadata = rel.metadata;

	if (!metadata || typeof metadata !== 'object') {
		return [
			{
				severity: 'warning',
				message: `[archimate-003] Relationship "${relId ?? '?'}" links ArchiMate nodes but is missing metadata.archimate.relationship`,
				...(relId ? { relationshipId: relId } : {}),
			},
		];
	}

	if (!validateRelationshipMetadata(metadata)) {
		return ajvErrorsToIssues(validateRelationshipMetadata.errors ?? [], 'Relationship metadata: ', {
			...(relId ? { relationshipId: relId } : {}),
			path: '/metadata',
		});
	}

	const archimate = (metadata as Record<string, unknown>).archimate;
	if (archimate && typeof archimate === 'object') {
		const archimateRel = (archimate as Record<string, unknown>).relationship;
		if (typeof archimateRel === 'string') {
			const expectedVariant = expectedCalmVariantForArchimateRelationship(archimateRel);
			const actualVariant = getRelationshipVariant(rel['relationship-type']);
			if (actualVariant !== expectedVariant) {
				return [
					{
						severity: 'error',
						message: `[archimate-004] Relationship "${relId ?? '?'}": metadata.archimate.relationship "${archimateRel}" requires relationship-type.${expectedVariant}, but got ${actualVariant}`,
						...(relId ? { relationshipId: relId } : {}),
					},
				];
			}
		}
	}

	return [];
}

/**
 * Validate ArchiMate domain rules for a CALM architecture document.
 */
export function runArchimateRules(
	arch: CalmArchitecture,
	validators: {
		validateNodeMetadata: ValidateFunction;
		validateRelationshipMetadata: ValidateFunction;
	},
): ValidationIssue[] {
	const issues: ValidationIssue[] = [];
	const archNodes = arch.nodes ?? [];
	const archRelationships = arch.relationships ?? [];

	const archimateNodeIds = new Set<string>();
	for (const node of archNodes) {
		if (!isArchimateNode(node)) continue;
		const nodeId = node['unique-id'];
		if (nodeId) archimateNodeIds.add(nodeId);
		issues.push(...validateArchimateNodeMetadata(node, validators.validateNodeMetadata));
	}

	for (const rel of archRelationships) {
		if (!relationshipTouchesArchimate(rel, archimateNodeIds)) continue;
		issues.push(
			...validateArchimateRelationshipMetadata(rel, validators.validateRelationshipMetadata),
		);
	}

	return issues;
}
