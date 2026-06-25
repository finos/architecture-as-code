// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * linkedDocument.ts — build the child document a node drills into.
 *
 * "Create linked document" turns a node into the parent of a new detailed
 * architecture: a fresh CALM document whose root node REUSES the source node's
 * `unique-id` (the identity-continuity the C4 drill checks for), one C4 level
 * deeper than the parent. Pure — the caller registers it and wires the parent
 * node's `details.detailed-architecture` to the returned ref.
 */

import type { CalmArchitecture, CalmNode } from '@calmstudio/calm-core';
import type { C4Level } from './c4Filter';

/** Canonical CALM 1.2 meta-schema (inlined to avoid pulling in the export module). */
const CALM_SCHEMA_URL = 'https://calm.finos.org/release/1.2/meta/calm.json';

/** One C4 level deeper than the parent (component is the floor). */
const NEXT_LEVEL: Record<C4Level, C4Level> = {
	context: 'container',
	container: 'component',
	component: 'component',
};

export interface LinkedDocSource {
	/** unique-id of the node being elaborated — reused as the child's root id. */
	id: string;
	name: string;
	nodeType: string;
	description?: string;
}

/** Read a `metadata.c4-level` (object or array metadata form), if valid. */
export function readC4Level(metadata: unknown): C4Level | undefined {
	const m = metadata;
	const obj = Array.isArray(m)
		? Object.assign({}, ...m.filter((x) => typeof x === 'object' && x !== null))
		: typeof m === 'object' && m !== null
			? (m as Record<string, unknown>)
			: {};
	const lvl = (obj as Record<string, unknown>)['c4-level'];
	return lvl === 'context' || lvl === 'container' || lvl === 'component' ? lvl : undefined;
}

/** The ref/filename used for a node's linked document (bare, sibling-relative). */
export function linkedDocRef(nodeId: string): string {
	return `${nodeId}.arch.json`;
}

/**
 * Build the linked child document for a source node. The child's root node
 * carries the source node's identity (so the drill resolves cleanly) and the
 * document declares its C4 level one step below the parent.
 */
export function buildLinkedDocument(
	source: LinkedDocSource,
	parentLevel?: C4Level,
): { ref: string; doc: CalmArchitecture } {
	const childLevel = NEXT_LEVEL[parentLevel ?? 'context'];
	const rootNode: CalmNode = {
		'unique-id': source.id,
		'node-type': source.nodeType || 'system',
		name: source.name,
		description: source.description ?? '',
	};
	const doc: CalmArchitecture = {
		$schema: CALM_SCHEMA_URL,
		nodes: [rootNode],
		relationships: [],
		metadata: { 'c4-level': childLevel },
	} as CalmArchitecture;
	return { ref: linkedDocRef(source.id), doc };
}
