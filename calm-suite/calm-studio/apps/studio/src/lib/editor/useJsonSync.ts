// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * useJsonSync.ts — Utilities for finding character offsets of CALM nodes and
 * relationships within a JSON string.
 *
 * Uses jsonpos to map from array-based paths to raw character ranges. This
 * enables the CodePanel to scroll and highlight the JSON block that corresponds
 * to the selected canvas element.
 */

import { jsonpos } from 'jsonpos';

/**
 * Find the character offset range for a CALM node within the JSON string.
 *
 * @param json - Raw CALM JSON string.
 * @param nodeUniqueId - The unique-id of the node to locate.
 * @returns `{ start, end }` character offsets, or null if not found.
 */
export function findNodeOffset(
	json: string,
	nodeUniqueId: string
): { start: number; end: number } | null {
	let parsed: { nodes?: Array<{ 'unique-id': string }> };

	try {
		parsed = JSON.parse(json);
	} catch {
		return null;
	}

	const nodes = parsed?.nodes;
	if (!Array.isArray(nodes)) return null;

	const idx = nodes.findIndex((n) => n['unique-id'] === nodeUniqueId);
	if (idx === -1) return null;

	try {
		const loc = jsonpos(json, { path: ['nodes', idx] });
		if (!loc || loc.start == null || loc.end == null) return null;
		return { start: loc.start.offset, end: loc.end.offset };
	} catch {
		return null;
	}
}

/**
 * Find the character offset range for a CALM relationship within the JSON string.
 *
 * @param json - Raw CALM JSON string.
 * @param relUniqueId - The unique-id of the relationship to locate.
 * @returns `{ start, end }` character offsets, or null if not found.
 */
export function findRelationshipOffset(
	json: string,
	relUniqueId: string
): { start: number; end: number } | null {
	let parsed: { relationships?: Array<{ 'unique-id': string }> };

	try {
		parsed = JSON.parse(json);
	} catch {
		return null;
	}

	const relationships = parsed?.relationships;
	if (!Array.isArray(relationships)) return null;

	const idx = relationships.findIndex((r) => r['unique-id'] === relUniqueId);
	if (idx === -1) return null;

	try {
		const loc = jsonpos(json, { path: ['relationships', idx] });
		if (!loc || loc.start == null || loc.end == null) return null;
		return { start: loc.start.offset, end: loc.end.offset };
	} catch {
		return null;
	}
}
