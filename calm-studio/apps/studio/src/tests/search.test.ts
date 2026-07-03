// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, test, expect } from 'vitest';
import type { Node } from '@xyflow/svelte';
import { createNodeSearcher, searchNodes } from '$lib/search/search';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeNode(id: string, label: string, calmType: string): Node {
	return {
		id,
		type: 'service',
		position: { x: 0, y: 0 },
		data: { label, calmId: `calm-${id}`, calmType },
	};
}

const fixture: Node[] = [
	makeNode('n1', 'User Auth Service', 'service'),
	makeNode('n2', 'Postgres Database', 'database'),
	makeNode('n3', 'Frontend App', 'webclient'),
	makeNode('n4', 'Mobile Gateway', 'service'),
	makeNode('n5', 'LDAP Directory', 'ldap'),
];

// ─── Search tests ─────────────────────────────────────────────────────────────

describe('node search', () => {
	test('createNodeSearcher creates a Fuse instance (object with search method)', () => {
		const searcher = createNodeSearcher(fixture);
		expect(searcher).toBeDefined();
		expect(typeof searcher.search).toBe('function');
	});

	test('searchNodes returns matching node IDs by name', () => {
		const searcher = createNodeSearcher(fixture);
		const results = searchNodes(searcher, 'auth');
		expect(results).toContain('n1');
	});

	test('searchNodes returns matching node IDs by type', () => {
		const searcher = createNodeSearcher(fixture);
		const results = searchNodes(searcher, 'database');
		expect(results).toContain('n2');
	});

	test('searchNodes returns multiple results when multiple nodes match', () => {
		const searcher = createNodeSearcher(fixture);
		const results = searchNodes(searcher, 'service');
		// n1 (User Auth Service — label) and n4 (service type)
		expect(results.length).toBeGreaterThanOrEqual(1);
	});

	test('empty query returns no matches', () => {
		const searcher = createNodeSearcher(fixture);
		const results = searchNodes(searcher, '');
		expect(results).toHaveLength(0);
	});

	test('searchNodes returns array of strings (node IDs)', () => {
		const searcher = createNodeSearcher(fixture);
		const results = searchNodes(searcher, 'frontend');
		expect(results.every((id) => typeof id === 'string')).toBe(true);
	});

	test('searchNodes returns node ID for exact label match', () => {
		const searcher = createNodeSearcher(fixture);
		const results = searchNodes(searcher, 'Postgres Database');
		expect(results).toContain('n2');
	});

	test('searchNodes returns node ID for node ID match', () => {
		const searcher = createNodeSearcher(fixture);
		const results = searchNodes(searcher, 'n5');
		expect(results).toContain('n5');
	});
});
