// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * c4State.svelte.ts — C4 view mode state store with Svelte 5 runes.
 *
 * Tracks C4 mode activation, the current C4 level, and the drill-down navigation stack.
 *
 * State model:
 *   - currentLevel: null = "All" mode (normal editing); C4Level = C4 navigation active
 *   - drillStack: navigation path for drill-down (e.g. [{nodeId:'sys-1', label:'Payment System'}])
 *
 * Pattern: module-level $state runes, same as history.svelte.ts, calmModel.svelte.ts.
 * No imports from .svelte files — only type imports from c4Filter.ts.
 */

import type { C4Level } from './c4Filter';

// ─── Types ───────────────────────────────────────────────────────────────────

/** A single entry in the drill-down navigation stack. */
export type DrillEntry = {
	nodeId: string;
	label: string;
};

// ─── Module-level state ───────────────────────────────────────────────────────

/** Current C4 level. null means C4 mode is off (normal editing). */
let currentLevel = $state<C4Level | null>(null);

/** Drill-down navigation stack. Empty = at the top level of the current C4 view. */
let drillStack = $state<DrillEntry[]>([]);

// ─── Getters ─────────────────────────────────────────────────────────────────

/**
 * Returns true when C4 mode is active (any level is selected).
 * False means the canvas is in normal "All" editing mode.
 */
export function isC4Mode(): boolean {
	return currentLevel !== null;
}

/**
 * Returns the current C4 level, or null if not in C4 mode.
 */
export function getC4Level(): C4Level | null {
	return currentLevel;
}

/**
 * Returns the current drill-down navigation stack.
 * Empty array = at root of the selected C4 level.
 */
export function getC4DrillStack(): DrillEntry[] {
	return drillStack;
}

/**
 * Returns the nodeId of the current drill target, or null if at the root.
 * Used by filterNodesForLevel as the drillParentId argument.
 */
export function getCurrentDrillParentId(): string | null {
	if (drillStack.length === 0) return null;
	return drillStack[drillStack.length - 1].nodeId;
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Enter C4 view mode at the given level.
 * Clears any existing drill stack (fresh top-level view).
 */
export function enterC4Mode(level: C4Level): void {
	currentLevel = level;
	drillStack = [];
}

/**
 * Exit C4 view mode and return to normal "All" editing mode.
 * Clears both the level and the drill stack.
 */
export function exitC4Mode(): void {
	currentLevel = null;
	drillStack = [];
}

/**
 * Switch to a different C4 level while staying in C4 mode.
 * Clears the drill stack (the new level starts at its own root).
 */
export function setC4Level(level: C4Level): void {
	currentLevel = level;
	drillStack = [];
}

/**
 * Drill into a container node, adding it to the navigation stack.
 * Used when the user double-clicks a node to explore its internals.
 *
 * @param nodeId - The ID of the node being drilled into.
 * @param label - The display label for the breadcrumb (node name).
 */
export function drillDown(nodeId: string, label: string): void {
	drillStack = [...drillStack, { nodeId, label }];
}

/**
 * Navigate back to a specific point in the drill stack.
 *
 * The stack is sliced to [0, index) — clicking breadcrumb at index 0 shows
 * the node at that position's children, clicking "root" (before index 0)
 * clears to top level. Per Pitfall 5: drillUpTo(0) returns to root (empty stack).
 *
 * @param index - The index to truncate the stack to (exclusive).
 *   Pass 0 to return to the top-level C4 view (no drill parent).
 */
export function drillUpTo(index: number): void {
	drillStack = drillStack.slice(0, index);
}

// ─── Test utilities ───────────────────────────────────────────────────────────

/**
 * Reset C4 state to initial values.
 * Use in tests with beforeEach to ensure clean state between tests.
 */
export function resetC4State(): void {
	currentLevel = null;
	drillStack = [];
}
