// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Sidecar file utilities for CalmStudio.
 *
 * The sidecar file (*.calmstudio.json) stores extension pack metadata
 * alongside the main CALM architecture file. It is never embedded in the
 * CALM JSON itself — that remains a pure CALM artefact.
 */

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
