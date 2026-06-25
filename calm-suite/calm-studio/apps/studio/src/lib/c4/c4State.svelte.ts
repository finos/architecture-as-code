// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * c4State.svelte.ts — C4 navigation as a document trail.
 *
 * One architecture file = one diagram (the Context of its system). A node can
 * carry a `details.detailed-architecture` link to another document; drilling it
 * jumps to that document. The `trail` is the path of documents you've followed;
 * trail[0] is the root (the editable document, ref = null). There are no levels
 * to switch and no within-document drilling — depth is simply how many links
 * deep you are. A document's declared `metadata.c4-level` is an optional label.
 *
 * Module-level $state runes; no imports from .svelte files.
 */

import type { C4Level } from './c4Filter';

// ─── Types ───────────────────────────────────────────────────────────────────

/** One document in the navigation trail. ref = null is the editable root document. */
export type C4Frame = { ref: string | null; label: string; level: C4Level };

const LEVELS: C4Level[] = ['context', 'container', 'component'];
const levelForDepth = (depth: number): C4Level => LEVELS[Math.min(depth, LEVELS.length - 1)]!;

// ─── Module-level state ───────────────────────────────────────────────────────

/** Whether C4 navigation (a read-only document view) is active. */
let active = $state(false);

/** The document trail. trail[0] is the editable root; each entry is one link deeper. */
let trail = $state<C4Frame[]>([]);

// ─── Getters ─────────────────────────────────────────────────────────────────

/** True when navigating a linked document (vs. editing the root document). */
export function isC4Mode(): boolean {
	return active;
}

/** The document trail (for the breadcrumb). */
export function getC4Trail(): C4Frame[] {
	return trail;
}

/** The current document's level (the top frame's), or null if not navigating. */
export function getC4Level(): C4Level | null {
	return active && trail.length > 0 ? trail[trail.length - 1]!.level : null;
}

/** The top frame, or null. */
export function getCurrentFrame(): C4Frame | null {
	return trail.length > 0 ? trail[trail.length - 1]! : null;
}

/**
 * The ref of the document currently in view (the top frame). `null` means the
 * root document (the editable model itself).
 */
export function getActiveDocumentRef(): string | null {
	return trail.length > 0 ? trail[trail.length - 1]!.ref : null;
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/** Enter navigation at the root (the editable document). */
export function enterC4(rootLabel: string, rootLevel: C4Level = 'context'): void {
	active = true;
	trail = [{ ref: null, label: rootLabel, level: rootLevel }];
}

/** Exit navigation, back to editing the root document. */
export function exitC4(): void {
	active = false;
	trail = [];
}

/**
 * Drill into a node's linked document (details.detailed-architecture). Prefers
 * the document's declared level, else depth-derived. Returns the level, or
 * **null if it would form a cycle** (that document is already in the trail).
 */
export function drillIntoDocument(ref: string, label: string, level?: C4Level): C4Level | null {
	if (trail.some((f) => f.ref === ref)) return null; // cycle
	const lvl = level ?? levelForDepth(trail.length);
	trail = [...trail, { ref, label, level: lvl }];
	return lvl;
}

/**
 * Navigate up to the frame at `index` (inclusive). Returns the new top frame, or
 * null. Valid range is [0, trail.length - 1]; a negative index is a no-op (use
 * exitC4 to leave), a too-large index clamps to the current top.
 */
export function navigateUpTo(index: number): C4Frame | null {
	if (index < 0) return null;
	const clamped = Math.min(index, trail.length - 1);
	trail = trail.slice(0, clamped + 1);
	return trail[trail.length - 1] ?? null;
}

// ─── Test utilities ───────────────────────────────────────────────────────────

/** Reset C4 state to initial values (use in tests' beforeEach). */
export function resetC4State(): void {
	active = false;
	trail = [];
}
