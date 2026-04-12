// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * validation.svelte.ts — On-demand validation store.
 *
 * Validation is user-triggered (via a "Validate" button), not automatic.
 * When the user clicks Validate, runValidation() is called, issues are
 * populated, and the panel opens. Issues remain visible until the user
 * closes the panel or runs validation again.
 *
 * IMPORTANT: This store READS getModel() but NEVER WRITES to calmModel.
 * Validation data is injected into node.data by +page.svelte.
 * This prevents the infinite loop described in RESEARCH Pitfall 3.
 */

import { getModel } from './calmModel.svelte';
import { validateCalmArchitecture, type ValidationIssue } from '@calmstudio/calm-core';
import { runAIGFRules } from '$lib/validation/aigf-rules';

// Re-export ValidationIssue for consumers that cannot resolve @calmstudio/calm-core via tsconfig
export type { ValidationIssue };

// ─── Module-level state ───────────────────────────────────────────────────────

let issues = $state<ValidationIssue[]>([]);
let panelOpen = $state(false);
let scrollToId = $state<string | null>(null);

// ─── On-demand validation ────────────────────────────────────────────────────

/**
 * Run validation on the current model and open the panel with results.
 * Called explicitly by the user (e.g., clicking a "Validate" button).
 */
export function runValidation(): void {
	const model = getModel();
	const structural = validateCalmArchitecture(model);
	const aigf = runAIGFRules(model);
	issues = [...structural, ...aigf];
	// Sort by severity: errors first, then warnings, then info
	const severityOrder: Record<string, number> = { error: 0, warning: 1, info: 2 };
	issues.sort((a, b) => (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2));
	panelOpen = true;
}

/**
 * Clear all validation results and close the panel.
 * Called on new file load or when user explicitly clears.
 */
export function clearValidation(): void {
	issues = [];
	panelOpen = false;
	scrollToId = null;
}

// ─── Accessor functions ───────────────────────────────────────────────────────

/** Returns all current validation issues. */
export function getIssues(): ValidationIssue[] {
	return issues;
}

/** Returns all issues for a specific element (node or relationship) by unique-id. */
export function getIssuesByElementId(id: string): ValidationIssue[] {
	return issues.filter((i) => i.nodeId === id || i.relationshipId === id);
}

/** Returns the count of error-severity issues for the given element. */
export function getErrorCountForElement(id: string): number {
	return issues.filter((i) => i.severity === 'error' && (i.nodeId === id || i.relationshipId === id)).length;
}

/** Returns the count of warning-severity issues for the given element. */
export function getWarningCountForElement(id: string): number {
	return issues.filter((i) => i.severity === 'warning' && (i.nodeId === id || i.relationshipId === id)).length;
}

/**
 * Returns the highest severity for the given element, or null if no issues.
 * Priority: error > warning > info
 */
export function getMaxSeverityForElement(id: string): 'error' | 'warning' | 'info' | null {
	const elementIssues = getIssuesByElementId(id);
	if (elementIssues.some((i) => i.severity === 'error')) return 'error';
	if (elementIssues.some((i) => i.severity === 'warning')) return 'warning';
	if (elementIssues.some((i) => i.severity === 'info')) return 'info';
	return null;
}

/** Returns true when the validation panel should be visible. */
export function isPanelOpen(): boolean {
	return panelOpen;
}

/** Close the validation panel. Issues are retained until next runValidation() or clearValidation(). */
export function closePanel(): void {
	panelOpen = false;
}

/** Open the validation panel (e.g., to review previous results). */
export function openPanel(): void {
	panelOpen = true;
}

/** Returns the element ID that the panel should scroll to (set by badge click). */
export function getScrollToElementId(): string | null {
	return scrollToId;
}

/** Set the element ID for panel scroll coordination (called by badge click). */
export function setScrollToElementId(id: string | null): void {
	scrollToId = id;
	// Also open the panel if it's closed when user clicks a badge
	if (id !== null) {
		panelOpen = true;
	}
}
