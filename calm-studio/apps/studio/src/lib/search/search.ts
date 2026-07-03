// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * search.ts — Fuse.js-based fuzzy search for canvas nodes.
 *
 * createNodeSearcher(nodes): creates a Fuse instance configured for node search
 * searchNodes(searcher, query): returns matching node IDs
 */

import Fuse from 'fuse.js';
import type { Node } from '@xyflow/svelte';

export type NodeSearcher = Fuse<Node>;

/**
 * Create a Fuse.js searcher instance for a given array of nodes.
 * Keys: data.label (name), data.calmType (CALM type), id
 * Threshold 0.4 — reasonably fuzzy without too many false positives.
 */
export function createNodeSearcher(nodes: Node[]): NodeSearcher {
	return new Fuse(nodes, {
		keys: ['data.label', 'data.calmType', 'id'],
		threshold: 0.4,
		includeScore: false,
	});
}

/**
 * Search nodes using the provided Fuse instance and query string.
 * Returns an array of matching node IDs.
 * Empty query returns no matches (Fuse returns all items for empty query).
 */
export function searchNodes(searcher: NodeSearcher, query: string): string[] {
	if (!query || query.trim() === '') {
		return [];
	}
	const results = searcher.search(query);
	return results.map((r) => r.item.id);
}
