// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * history.svelte.ts — Undo/redo snapshot store for CalmCanvas.
 *
 * Stores deep-cloned snapshots of nodes/edges arrays.
 * Snapshots MUST be pushed BEFORE mutations (RESEARCH Pitfall 6).
 *
 * Pattern: push the canvas state BEFORE a mutation.
 * - undo restores that snapshot and keeps the live canvas for redo
 * - redo re-applies the canvas passed into undo
 */

import type { Node, Edge } from '@xyflow/svelte';

export interface Snapshot {
	nodes: Node[];
	edges: Edge[];
}

export interface HistoryState {
	stack: Snapshot[];
	pointer: number;
}

const MAX_HISTORY = 50;

function cloneSnapshot(s: Snapshot): Snapshot {
	return {
		nodes: JSON.parse(JSON.stringify(s.nodes)),
		edges: JSON.parse(JSON.stringify(s.edges)),
	};
}

export function createEmptyHistoryState(): HistoryState {
	return { stack: [], pointer: -1 };
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
	if (stack.length > MAX_HISTORY) {
		const overflow = stack.length - MAX_HISTORY;
		stack = stack.slice(overflow);
	}
	pointer = stack.length - 1;
}

/**
 * Restore the latest snapshot pushed before a mutation.
 * Pass the live canvas so redo can return to it.
 * Returns null when there is nothing to undo.
 */
export function undo(current?: { nodes: Node[]; edges: Edge[] }): Snapshot | null {
	if (pointer < 0) return null;
	if (current) {
		const saved = cloneSnapshot(current);
		if (pointer + 1 < stack.length) {
			stack = stack.map((entry, index) => (index === pointer + 1 ? saved : entry));
		} else {
			stack = [...stack, saved];
		}
	}
	const snapshot = stack[pointer];
	pointer -= 1;
	return snapshot ?? null;
}

/**
 * Re-apply the canvas state saved by the last undo.
 * Returns null when there is nothing to redo.
 */
export function redo(): Snapshot | null {
	const redoIndex = pointer + 2;
	if (redoIndex >= stack.length) return null;
	pointer = redoIndex - 1;
	return stack[redoIndex] ?? null;
}

/** True when a snapshot pushed before a mutation can be restored. */
export function canUndo(): boolean {
	return pointer >= 0;
}

/** True when an undone canvas state can be re-applied. */
export function canRedo(): boolean {
	return pointer + 2 < stack.length;
}

/**
 * Reset history to initial empty state.
 * Used in tests to ensure clean state between test runs.
 */
export function resetHistory(): void {
	stack = [];
	pointer = -1;
}

/** Export current undo stack for tab persistence. */
export function exportHistoryState(): HistoryState {
	return {
		stack: stack.map(cloneSnapshot),
		pointer,
	};
}

/** Restore undo stack when activating a tab. */
export function loadHistoryState(state: HistoryState): void {
	stack = state.stack.map(cloneSnapshot);
	pointer = state.pointer;
}
