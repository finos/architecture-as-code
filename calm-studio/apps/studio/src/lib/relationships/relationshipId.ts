// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { normalizeSlug } from '$lib/project/naming';

/** Svelte Flow's generated edge id. It must not become a CALM `unique-id`. */
export function isFlowGeneratedEdgeId(id: string): boolean {
	return id.startsWith('xy-edge');
}

/**
 * Base id for a new relationship: the same slug rule as a new file name
 * (`normalizeSlug` / `{{name}}`). `naming.patterns` stays a file path template.
 */
export function relationshipIdBase(source: string, type: string, target: string): string {
	return normalizeSlug(`${source}-${type}-${target}`) || 'relationship';
}

/** First free id: base, then `base-2`, `base-3`, … */
export function allocateRelationshipId(
	source: string,
	type: string,
	target: string,
	taken: Iterable<string>,
): string {
	const used = new Set(taken);
	const base = relationshipIdBase(source, type, target);
	if (!used.has(base)) return base;
	let n = 2;
	while (used.has(`${base}-${n}`)) n += 1;
	return `${base}-${n}`;
}

/**
 * CALM `unique-id` already stored on an edge.
 * Returns null for a Svelte Flow id (`xy-edge__…`) and for inferred parent edges,
 * so those are allocated instead of collapsed to `xy-edge`.
 */
export function storedRelationshipIdFromEdge(edge: { id: string; data?: unknown }): string | null {
	const data = edge.data as { calmRelId?: string } | undefined;
	if (typeof data?.calmRelId === 'string' && data.calmRelId.length > 0) return data.calmRelId;
	if (isFlowGeneratedEdgeId(edge.id) || edge.id.startsWith('inferred-')) return null;
	const hash = edge.id.indexOf('#');
	if (hash > 0) return edge.id.slice(0, hash);
	const underscore = edge.id.indexOf('__');
	if (underscore > 0) return edge.id.slice(0, underscore);
	return edge.id;
}
