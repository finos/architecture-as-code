// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

/**
 * containment.ts — Pure functions for managing CALM containment relationships.
 *
 * In CALM, 'deployed-in' and 'composed-of' edges represent containment —
 * a child node that lives inside a parent boundary. Svelte Flow models this
 * via parentId and extent:'parent' on the child node, plus a 'container' type
 * on the parent.
 *
 * All functions are pure (no mutations, no side-effects) and return new arrays.
 */

import type { Node, Edge } from '@xyflow/svelte';
import { nanoid } from 'nanoid';

/** Default dimensions when promoting a node to a container. */
export const CONTAINER_DEFAULT_WIDTH = 300;
export const CONTAINER_DEFAULT_HEIGHT = 200;

/** The set of CALM edge types that imply containment. */
const CONTAINMENT_EDGE_TYPES = new Set(['deployed-in', 'composed-of']);

/**
 * Returns true when the given edge type implies containment.
 * Used to decide whether to call makeContainment() after edge creation.
 *
 * @param edgeType - A CALM relationship type string.
 */
export function isContainmentType(edgeType: string): boolean {
	return CONTAINMENT_EDGE_TYPES.has(edgeType);
}

/**
 * Hide composed-of / deployed-in edges on the canvas; keep connects/interacts visible.
 * Nesting is shown via parentId boxes — the JSON relationship stays in the model.
 */
export function applyContainmentVisibility(edges: Edge[]): Edge[] {
	let changed = false;
	const next = edges.map((e) => {
		const hidden = isContainmentType(e.type ?? '');
		if (e.hidden === hidden) return e;
		changed = true;
		return { ...e, hidden };
	});
	return changed ? next : edges;
}

/**
 * Establishes a containment relationship between parent and child nodes.
 *
 * - Sets parentId on the child node (Svelte Flow nesting)
 * - Sets extent:'parent' on the child so it stays inside the parent
 * - Converts the parent to type:'container' if it isn't already
 *
 * Returns a new nodes array. Does not mutate the input.
 *
 * @param parentId - ID of the node that will become the container.
 * @param childId  - ID of the node to nest inside the container.
 * @param nodes    - Current nodes array.
 */
export function makeContainment(parentId: string, childId: string, nodes: Node[]): Node[] {
	// Compute the nesting depth of the parent so child gets a higher z-index.
	// This ensures clicking a deeply-nested child selects it, not the container.
	let depth = 1;
	let currentId: string | undefined = parentId;
	while (currentId) {
		const parent = nodes.find((n) => n.id === currentId);
		if (parent?.parentId) {
			depth++;
			currentId = parent.parentId;
		} else {
			break;
		}
	}

	const parentNode = nodes.find((n) => n.id === parentId);
	const inputChild = nodes.find((n) => n.id === childId);
	const parentW = Math.max(
		parentNode?.width ?? 0,
		parentNode?.measured?.width ?? 0,
		CONTAINER_DEFAULT_WIDTH
	);
	const parentH = Math.max(
		parentNode?.height ?? 0,
		parentNode?.measured?.height ?? 0,
		CONTAINER_DEFAULT_HEIGHT
	);
	const HEADER = 40;
	const INSET = 20;

	return nodes.map((node) => {
		if (node.id === parentId) {
			const width = Math.max(node.width ?? 0, node.measured?.width ?? 0, CONTAINER_DEFAULT_WIDTH);
			const height = Math.max(node.height ?? 0, node.measured?.height ?? 0, CONTAINER_DEFAULT_HEIGHT);
			if (node.type === 'container') {
				if (node.width === width && node.height === height) return node;
				return { ...node, width, height };
			}
			return { ...node, type: 'container', width, height };
		}
		if (node.id === childId) {
			// Coordinates with parentId must be parent-relative. When containment is
			// established via property panel (connects → composed-of), calmToFlow may
			// leave absolute canvas coords — detect and convert.
			const absToRel = parentNode
				? {
						x: node.position.x - parentNode.position.x,
						y: node.position.y - parentNode.position.y,
					}
				: node.position;
			const looksAbsolute =
				!inputChild?.parentId ||
				node.position.x > parentW ||
				node.position.y > parentH;
			const raw = looksAbsolute ? absToRel : node.position;
			const position = {
				x: Math.max(INSET, Math.min(raw.x, parentW - INSET - 80)),
				y: Math.max(HEADER, Math.min(raw.y, parentH - INSET - 60)),
			};
			return { ...node, parentId, extent: 'parent' as const, zIndex: depth, position };
		}
		return node;
	});
}

/**
 * Applies containment layout for every composed-of / deployed-in edge.
 * Call after re-projecting from the CALM model so container dimensions and
 * child parent-relative positions stay in sync with relationship types.
 */
export function applyContainmentFromEdges(nodes: Node[], edges: Edge[]): Node[] {
	let result = nodes;
	for (const edge of edges) {
		const edgeType = edge.type ?? '';
		if (isContainmentType(edgeType)) {
			result = makeContainment(edge.source, edge.target, result);
		}
	}
	return syncContainmentRelData(result, edges);
}

/** Attach containment relationship summaries onto container node data (header icon). */
export function syncContainmentRelData(nodes: Node[], edges: Edge[]): Node[] {
	const byParent = new Map<
		string,
		Array<{ uniqueId: string; name: string; variant: 'composed-of' | 'deployed-in' }>
	>();
	for (const e of edges) {
		if (!isContainmentType(e.type ?? '')) continue;
		const uniqueId = String((e.data as { calmRelId?: string } | undefined)?.calmRelId ?? e.id);
		const variant = (e.type === 'deployed-in' ? 'deployed-in' : 'composed-of') as
			| 'composed-of'
			| 'deployed-in';
		const list = byParent.get(e.source) ?? [];
		if (!list.some((r) => r.uniqueId === uniqueId)) {
			list.push({ uniqueId, name: uniqueId, variant });
		}
		byParent.set(e.source, list);
	}
	return nodes.map((n) => {
		const rels = byParent.get(n.id) ?? [];
		const current = n.data?.containmentRels as unknown;
		if (JSON.stringify(current ?? []) === JSON.stringify(rels)) return n;
		return { ...n, data: { ...n.data, containmentRels: rels } };
	});
}

/**
 * Ensures a containment relationship edge exists between parent and child.
 * Used when visual nesting is established via drag-into-container.
 */
export function ensureContainmentEdge(
	parentId: string,
	childId: string,
	edges: Edge[],
	variant: 'composed-of' | 'deployed-in' = 'composed-of'
): Edge[] {
	const exists = edges.some(
		(e) => e.source === parentId && e.target === childId && e.type === variant
	);
	if (exists) return edges;

	return [
		...edges,
		{
			id: nanoid(),
			source: parentId,
			target: childId,
			type: variant,
			hidden: true,
			data: {
				protocol: '',
				description: '',
				calmVariant: variant,
			},
		},
	];
}

/**
 * Removes a containment relationship from a child node.
 *
 * Clears parentId and extent so the child is no longer nested.
 * Does not change the parent node's type (the parent may still contain
 * other children so it stays as 'container').
 *
 * Returns a new nodes array. Does not mutate the input.
 *
 * @param childId - ID of the node to un-nest.
 * @param nodes   - Current nodes array.
 */
export function removeContainment(childId: string, nodes: Node[]): Node[] {
	return nodes.map((node) => {
		if (node.id !== childId) return node;
		// Spread into a new object, then delete the containment fields
		const { parentId: _pid, extent: _ext, ...rest } = node;
		return rest as Node;
	});
}
