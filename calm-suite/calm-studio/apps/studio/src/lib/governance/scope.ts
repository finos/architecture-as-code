// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * scope.ts — resolve which architecture elements a node's governance covers.
 *
 * CALM `decorators.applies-to` references **real element unique-ids** (nodes,
 * relationships, flows) — there is no document-level id. So whole-system
 * governance attaches to the document's top-level **system node** (its subject),
 * and a node inherits the governance of the systems that contain it (via the
 * `composed-of` / `deployed-in` containment relationships). (The legacy
 * `@architecture` sentinel is still honoured for back-compat, but new bindings
 * target real elements.)
 */

import type { CalmArchitecture } from '@calmstudio/calm-core';

/** Map each contained node id → its containing node id. */
function containmentParents(arch: CalmArchitecture): Map<string, string> {
	const parent = new Map<string, string>();
	for (const rel of arch.relationships ?? []) {
		const rt = rel['relationship-type'] as
			| Record<string, { container?: string; nodes?: string[] }>
			| undefined;
		const containment = rt?.['composed-of'] ?? rt?.['deployed-in'];
		if (containment?.container && Array.isArray(containment.nodes)) {
			for (const child of containment.nodes) parent.set(child, containment.container);
		}
	}
	return parent;
}

/**
 * A node plus the containing systems it inherits governance from (nearest first).
 * E.g. an `agent-runtime` inside `agent-layer` inside `multi-agent-system` →
 * `['agent-runtime', 'agent-layer', 'multi-agent-system']`.
 */
export function elementScopeChain(arch: CalmArchitecture, elementId: string): string[] {
	const parents = containmentParents(arch);
	const chain = [elementId];
	const seen = new Set([elementId]);
	let current = elementId;
	while (parents.has(current)) {
		const p = parents.get(current)!;
		if (seen.has(p)) break; // guard against a malformed containment cycle
		seen.add(p);
		chain.push(p);
		current = p;
	}
	return chain;
}

/** Every top-level (uncontained) `system` node — for the multi-system picker. */
export function topLevelSystemNodeIds(arch: CalmArchitecture): string[] {
	const parents = containmentParents(arch);
	return (arch.nodes ?? [])
		.filter((n) => !parents.has(n['unique-id']) && n['node-type'] === 'system')
		.map((n) => n['unique-id']);
}

/**
 * The document's top-level **system** node (its subject), for whole-system
 * bindings — the first uncontained `system` node, else the first uncontained
 * node, else null (an empty document). NB: when a document has multiple peer
 * top-level systems this returns the first; callers that need to disambiguate
 * should use {@link topLevelSystemNodeIds}.
 */
export function rootSystemNodeId(arch: CalmArchitecture): string | null {
	const parents = containmentParents(arch);
	const topLevel = (arch.nodes ?? []).filter((n) => !parents.has(n['unique-id']));
	return (
		topLevel.find((n) => n['node-type'] === 'system')?.['unique-id'] ??
		topLevel[0]?.['unique-id'] ??
		null
	);
}
