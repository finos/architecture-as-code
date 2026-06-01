// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * decorators.ts — Decorator-aware helpers and typed extensions of the base
 * CALM 1.2 decorator schema.
 *
 * Backs CalmStudio's generic decorator support (#2551). Defines two
 * extension shapes used by the FINOS Multi-Agent threat-model artefact:
 *
 *   - CalmThreatModelDecorator     type: "threat-model"
 *   - CalmControlCatalogDecorator  type: "control-catalog"
 *
 * Plus reverse-lookup helpers for the UI:
 *
 *   - getDecoratorsByType
 *   - getDecoratorsForNode
 *   - getThreatsForNode
 *   - getControlById
 *
 * No upstream CALM 1.2 schema change required — these are consumer-side
 * conventions over the open `data: Record<string, unknown>` field.
 */

import type { CalmArchitecture, CalmDecorator } from './types.js';

// ─── Threat-model decorator shape ────────────────────────────────────────────

/**
 * One threat entry inside a threat-model decorator's `data.threats[]`.
 * Mirrors the row format of the FINOS Multi-Agent Threat Model.
 */
export interface CalmThreat {
	/** Threat identifier (e.g. T-AGL-01). */
	id: string;
	/** Short threat name. */
	name: string;
	/** Long-form threat description. */
	description: string;
	/** Mitigation summary (prose). */
	mitigations: string;
	/** Control IDs referenced by this threat (resolved against control-catalog). */
	controls: string[];
	/**
	 * Subset of the parent decorator's `applies-to` that this specific threat
	 * targets. Optional — when absent, the threat is assumed to apply to every
	 * node in the parent decorator's `applies-to`.
	 */
	'affected-nodes'?: string[];
	/** Optional sub-section within a layer (e.g. "Tools Layer", "Memory"). */
	section?: string;
	/** Optional list of affected layer names for cross-layer threats. */
	'affected-layers'?: string[];
}

/**
 * Data payload of a `type: "threat-model"` decorator.
 */
export interface CalmThreatModelData {
	threats: CalmThreat[];
	/** Layer name (e.g. "Agent Gateway Layer"). */
	layer?: string;
	/** Framework label (e.g. "FINOS Multi-Agent Reference Architecture Threat Model"). */
	framework?: string;
	/** Framework version. */
	version?: string;
	/** Free-form additional fields. */
	[key: string]: unknown;
}

/**
 * Typed view over a CalmDecorator with `type: "threat-model"`.
 */
export interface CalmThreatModelDecorator extends CalmDecorator {
	type: 'threat-model';
	data: CalmThreatModelData;
}

// ─── Control-catalog decorator shape ─────────────────────────────────────────

export interface CalmControlEntry {
	id: string;
	description: string;
}

export interface CalmControlCatalogData {
	controls: CalmControlEntry[];
	framework?: string;
	version?: string;
	[key: string]: unknown;
}

export interface CalmControlCatalogDecorator extends CalmDecorator {
	type: 'control-catalog';
	data: CalmControlCatalogData;
}

// ─── Type guards ─────────────────────────────────────────────────────────────

export function isThreatModelDecorator(d: CalmDecorator): d is CalmThreatModelDecorator {
	if (d.type !== 'threat-model') return false;
	const data = d.data as { threats?: unknown };
	return Array.isArray(data.threats);
}

export function isControlCatalogDecorator(d: CalmDecorator): d is CalmControlCatalogDecorator {
	if (d.type !== 'control-catalog') return false;
	const data = d.data as { controls?: unknown };
	return Array.isArray(data.controls);
}

// ─── Reverse-lookup helpers ──────────────────────────────────────────────────

/**
 * Return every decorator whose `type` matches the given string.
 * Returns `[]` when the architecture has no `decorators` array.
 */
export function getDecoratorsByType(
	arch: CalmArchitecture,
	type: string,
): CalmDecorator[] {
	if (!arch.decorators) return [];
	return arch.decorators.filter((d) => d.type === type);
}

/**
 * Return every decorator that targets the given node id, by checking either
 * the top-level `applies-to[]` or — for threat-model decorators — each
 * inner threat's `affected-nodes[]`.
 *
 * Used by the Studio properties panel to render a per-node "Threats" tab.
 */
export function getDecoratorsForNode(
	arch: CalmArchitecture,
	nodeId: string,
): CalmDecorator[] {
	if (!arch.decorators) return [];
	return arch.decorators.filter((d) => {
		if (Array.isArray(d['applies-to']) && d['applies-to'].includes(nodeId)) return true;
		// Reach into threat-model data.threats[*].affected-nodes
		if (isThreatModelDecorator(d)) {
			for (const t of d.data.threats) {
				if (t['affected-nodes']?.includes(nodeId)) return true;
			}
		}
		return false;
	});
}

/**
 * Aggregate every threat (across all threat-model decorators) that targets
 * the given node id. A threat targets a node when:
 *
 *   - `threat['affected-nodes']` includes the node id, OR
 *   - `threat['affected-nodes']` is absent AND the parent decorator's
 *     `applies-to[]` includes the node id (implicit fall-back).
 *
 * Order: decorators in document order, threats within decorator in document order.
 */
export function getThreatsForNode(
	arch: CalmArchitecture,
	nodeId: string,
): CalmThreat[] {
	if (!arch.decorators) return [];
	const out: CalmThreat[] = [];
	for (const d of arch.decorators) {
		if (!isThreatModelDecorator(d)) continue;
		const parentAppliesTo = Array.isArray(d['applies-to']) ? d['applies-to'] : [];
		for (const t of d.data.threats) {
			const explicit = t['affected-nodes'];
			if (explicit) {
				if (explicit.includes(nodeId)) out.push(t);
			} else if (parentAppliesTo.includes(nodeId)) {
				out.push(t);
			}
		}
	}
	return out;
}

/**
 * Look up a control entry by id across every control-catalog decorator in
 * the architecture. Returns `null` when no match.
 *
 * The first match wins (decorators in document order). When two catalogs
 * disagree on the same id, the earlier one is authoritative — matches how
 * Studio renders the property pane (single source of truth per id).
 */
export function getControlById(
	arch: CalmArchitecture,
	controlId: string,
): CalmControlEntry | null {
	if (!arch.decorators) return null;
	for (const d of arch.decorators) {
		if (!isControlCatalogDecorator(d)) continue;
		for (const c of d.data.controls) {
			if (c.id === controlId) return c;
		}
	}
	return null;
}
