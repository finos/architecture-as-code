// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * decorators.svelte.ts — Reactive decorator store (#2551).
 *
 * Generic over decorator `type`. Backs the per-node "Threats" panel in the
 * properties sidebar, the canvas badge for threatened nodes, and the
 * control catalog lookup used in threat detail rows.
 *
 * Patterns:
 * - Module-level $state rune
 * - Exported accessor + mutator functions (no class instances)
 * - Pure: composes calm-core helpers; no side effects
 */

import { getModel } from '$lib/stores/calmModel.svelte';
import {
	getDecoratorsByType,
	getDecoratorsForNode,
	getThreatsForNode,
	getControlById,
	isThreatModelDecorator,
	type CalmDecorator,
	type CalmThreat,
	type CalmControlEntry,
	type CalmThreatModelDecorator,
	type CalmControlCatalogDecorator
} from '@calmstudio/calm-core';

// ─── Accessors ───────────────────────────────────────────────────────────────

/** Return all decorators of a given type from the current model. */
export function decoratorsByType(type: string): CalmDecorator[] {
	return getDecoratorsByType(getModel(), type);
}

/** Return all threat-model decorators (narrowed). */
export function threatModelDecorators(): CalmThreatModelDecorator[] {
	return (getModel().decorators ?? []).filter(isThreatModelDecorator);
}

/** Return all control-catalog decorators (narrowed). */
export function controlCatalogDecorators(): CalmControlCatalogDecorator[] {
	return getDecoratorsByType(getModel(), 'control-catalog') as CalmControlCatalogDecorator[];
}

/** Return every decorator that references the given node id. */
export function decoratorsForNode(nodeId: string): CalmDecorator[] {
	return getDecoratorsForNode(getModel(), nodeId);
}

/** Aggregate every threat that references the given node id. */
export function threatsForNode(nodeId: string): CalmThreat[] {
	return getThreatsForNode(getModel(), nodeId);
}

/** Look up a control entry by id in any control-catalog decorator. */
export function controlById(controlId: string): CalmControlEntry | null {
	return getControlById(getModel(), controlId);
}

/** Quick boolean — does this node have any threats attached? */
export function nodeHasThreats(nodeId: string): boolean {
	return threatsForNode(nodeId).length > 0;
}

/** Total threat count across all threat-model decorators in the arch. */
export function totalThreatCount(): number {
	let n = 0;
	for (const d of threatModelDecorators()) n += d.data.threats.length;
	return n;
}

/**
 * Build a Map from nodeId to the list of threats targeting it. Used by the
 * canvas to badge threatened nodes in one pass instead of N reverse lookups.
 */
export function buildNodeThreatIndex(): Map<string, CalmThreat[]> {
	const idx = new Map<string, CalmThreat[]>();
	const model = getModel();
	for (const d of model.decorators ?? []) {
		if (!isThreatModelDecorator(d)) continue;
		const parentAppliesTo = Array.isArray(d['applies-to']) ? d['applies-to'] : [];
		for (const t of d.data.threats) {
			const targets = t['affected-nodes'] ?? parentAppliesTo;
			for (const id of targets) {
				if (!idx.has(id)) idx.set(id, []);
				idx.get(id)!.push(t);
			}
		}
	}
	return idx;
}
