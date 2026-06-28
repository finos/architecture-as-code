// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * clipboard.svelte.ts — Copy/paste store for CalmCanvas.
 *
 * copy(nodes): stores deep clones of all selected nodes
 * paste(existingNodes): returns new nodes with fresh nanoid IDs,
 *   new calmId, position offset +20/+20, and selected:false
 */

import { nanoid } from 'nanoid';
import type { Node } from '@xyflow/svelte';

// Module-level Svelte 5 rune state
let clipboardNodes = $state<Node[]>([]);

/**
 * Copy the currently selected nodes into the clipboard.
 * Only nodes with `selected: true` are stored.
 */
export function copy(nodes: Node[]): void {
	const selected = nodes.filter((n) => n.selected);
	// Deep clone to avoid later mutations affecting clipboard
	clipboardNodes = JSON.parse(JSON.stringify(selected));
}

/**
 * Paste clipboard nodes as new nodes with fresh IDs and +20/+20 position offset.
 * Returns the new nodes to be appended to the canvas — does NOT mutate existingNodes.
 * Returns empty array if clipboard is empty.
 */
export function paste(existingNodes: Node[]): Node[] {
	if (clipboardNodes.length === 0) return [];

	return clipboardNodes.map((n) => {
		const newId = nanoid();
		const clone: Node = {
			...JSON.parse(JSON.stringify(n)),
			id: newId,
			position: {
				x: n.position.x + 20,
				y: n.position.y + 20,
			},
			selected: false,
			data: {
				...JSON.parse(JSON.stringify(n.data)),
				calmId: newId,
			},
		};
		return clone;
	});
}

/** True when there are nodes on the clipboard. */
export function hasClipboard(): boolean {
	return clipboardNodes.length > 0;
}

/**
 * Reset clipboard to empty state.
 * Used in tests to ensure clean state between test runs.
 */
export function resetClipboard(): void {
	clipboardNodes = [];
}
