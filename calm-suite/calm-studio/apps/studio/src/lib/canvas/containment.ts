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

import type { Node } from '@xyflow/svelte';

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

	return nodes.map((node) => {
		if (node.id === parentId) {
			// Promote to container type if not already
			if (node.type === 'container') return node;
			return { ...node, type: 'container' };
		}
		if (node.id === childId) {
			return { ...node, parentId, extent: 'parent' as const, zIndex: depth };
		}
		return node;
	});
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
