// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * history.svelte.ts — Undo/redo snapshot store for CalmCanvas.
 *
 * Stores deep-cloned snapshots of nodes/edges arrays.
 * Snapshots MUST be pushed BEFORE mutations (RESEARCH Pitfall 6).
 *
 * Pattern: snapshot array + pointer
 * - pushSnapshot: slice future history, push clone, increment pointer
 * - undo: decrement pointer, return snapshot (or null at start)
 * - redo: increment pointer, return snapshot (or null at end)
 */

import type { Node, Edge } from '@xyflow/svelte';

export interface Snapshot {
	nodes: Node[];
	edges: Edge[];
}

// Module-level Svelte 5 rune state
let stack = $state<Snapshot[]>([]);
let pointer = $state(-1);

/**
 * Push a deep-cloned snapshot of the current nodes/edges onto the history stack.
 * Any future history (from prior undos) is dropped.
 * Call this BEFORE applying any mutation.
 */
export function pushSnapshot(nodes: Node[], edges: Edge[]): void {
	// Deep clone to prevent mutations from affecting stored snapshot
	const snapshot: Snapshot = {
		nodes: JSON.parse(JSON.stringify(nodes)),
		edges: JSON.parse(JSON.stringify(edges)),
	};
	// Drop future history (everything after the current pointer)
	stack = stack.slice(0, pointer + 1);
	stack = [...stack, snapshot];
	pointer = stack.length - 1;
}

/**
 * Move back one step in history.
 * Returns the previous snapshot, or null if already at the start.
 */
export function undo(): Snapshot | null {
	if (pointer <= 0) {
		return null;
	}
	pointer = pointer - 1;
	return stack[pointer];
}

/**
 * Move forward one step in history.
 * Returns the next snapshot, or null if already at the end.
 */
export function redo(): Snapshot | null {
	if (pointer >= stack.length - 1) {
		return null;
	}
	pointer = pointer + 1;
	return stack[pointer];
}

/** True when there is a previous snapshot to undo to. */
export function canUndo(): boolean {
	return pointer > 0;
}

/** True when there is a future snapshot to redo to. */
export function canRedo(): boolean {
	return pointer < stack.length - 1;
}

/**
 * Reset history to initial empty state.
 * Used in tests to ensure clean state between test runs.
 */
export function resetHistory(): void {
	stack = [];
	pointer = -1;
}
