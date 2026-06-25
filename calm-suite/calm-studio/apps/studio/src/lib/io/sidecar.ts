// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Sidecar file utilities for CalmStudio.
 *
 * Two kinds of sidecar live alongside the main CALM architecture file, and
 * neither is ever embedded in the CALM JSON itself — that remains a pure CALM
 * artefact:
 *
 *   - `*.calmstudio.json`  — extension-pack metadata (SidecarData).
 *   - `*.decorators.json`  — the architecture's CALM 1.2 decorators
 *     (DecoratorSidecar). Decorators are an external overlay per the spec:
 *     their required `target` field references the architecture by file path,
 *     so they cannot live inside the document they decorate.
 */

import type { CalmDecorator } from '@calmstudio/calm-core';

/** Data structure stored in a .calmstudio.json sidecar file */
export interface SidecarData {
	/** Pack IDs used in the diagram (e.g. ['aws', 'k8s']) */
	packs: string[];
	/** Sidecar schema version */
	version: string;
	/** Per-pack version string (pack id -> version) */
	packVersions: Record<string, string>;
}

/**
 * Derives the sidecar filename from the diagram filename.
 * Replaces the trailing `.json` extension with `.calmstudio.json`.
 *
 * @example
 * sidecarNameFor('architecture.json')       // 'architecture.calmstudio.json'
 * sidecarNameFor('my-diagram.calm.json')    // 'my-diagram.calm.calmstudio.json'
 */
export function sidecarNameFor(diagramName: string): string {
	if (diagramName.endsWith('.json')) {
		return diagramName.slice(0, -5) + '.calmstudio.json';
	}
	return diagramName + '.calmstudio.json';
}

/**
 * Scans a CALM architecture object for colon-prefixed node types and returns
 * the unique pack IDs found.
 *
 * @example
 * detectPacksFromArch({ nodes: [{ 'node-type': 'aws:lambda' }, { 'node-type': 'actor' }] })
 * // ['aws']
 */
export function detectPacksFromArch(arch: { nodes: Array<{ 'node-type': string }> }): string[] {
	const seen = new Set<string>();
	for (const node of arch.nodes) {
		const nodeType = node['node-type'];
		const colonIdx = nodeType.indexOf(':');
		if (colonIdx !== -1) {
			seen.add(nodeType.slice(0, colonIdx));
		}
	}
	return [...seen];
}

/**
 * Builds a SidecarData object for the given pack IDs.
 * All packs are assigned version '1.0.0' by default.
 */
export function buildSidecarData(packIds: string[]): SidecarData {
	const packVersions: Record<string, string> = {};
	for (const id of packIds) {
		packVersions[id] = '1.0.0';
	}
	return {
		packs: [...packIds],
		version: '1.0',
		packVersions,
	};
}

// ─── Decorator sidecar (*.decorators.json) ──────────────────────────────────

/** The generic placeholder `target` that gemara decorators carry before they
 * know their owning document. Replaced with the real architecture filename
 * when a decorator is written to its sidecar. */
const PLACEHOLDER_TARGET = 'architecture.json';

/** Data structure stored in a `.decorators.json` sidecar file. A Studio-owned
 * container — the CALM 1.2 spec defines only a single decorator object
 * (`decorators.json#/defs/decorator`), so each element validates individually
 * while the `{ decorators: [...] }` wrapper is our own (mirrors how
 * `.calmstudio.json` is a Studio-owned, non-CALM file). */
export interface DecoratorSidecar {
	decorators: CalmDecorator[];
}

/**
 * Derives the decorator-sidecar filename from the diagram filename, replacing
 * the trailing `.json` with `.decorators.json`.
 *
 * @example
 * decoratorSidecarNameFor('architecture.json')    // 'architecture.decorators.json'
 * decoratorSidecarNameFor('payments.arch.json')   // 'payments.arch.decorators.json'
 */
export function decoratorSidecarNameFor(diagramName: string): string {
	if (diagramName.endsWith('.json')) {
		return diagramName.slice(0, -5) + '.decorators.json';
	}
	return diagramName + '.decorators.json';
}

/**
 * Stamp a decorator's `target` so it references the architecture file it is
 * being saved next to. Drops the generic `architecture.json` placeholder and
 * empty entries, then ensures the real filename is present (first). Any other
 * explicit targets the decorator already carries (multi-target overlays) are
 * preserved.
 */
export function stampDecoratorTarget(decorator: CalmDecorator, archFileName: string): CalmDecorator {
	const cleaned = (decorator.target ?? []).filter(
		(t) => t !== '' && t !== PLACEHOLDER_TARGET && t !== archFileName,
	);
	return { ...decorator, target: [archFileName, ...cleaned] };
}

/**
 * Build the `.decorators.json` sidecar payload for an architecture's
 * decorators, stamping each decorator's `target` to the architecture filename.
 * Pure data shaping — callers serialize the result.
 */
export function buildDecoratorSidecarData(
	decorators: CalmDecorator[],
	archFileName: string,
): DecoratorSidecar {
	return {
		decorators: decorators.map((d) => stampDecoratorTarget(d, archFileName)),
	};
}
