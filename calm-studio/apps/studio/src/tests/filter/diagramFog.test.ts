// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, test } from 'vitest';
import type { Node, Edge } from '@xyflow/svelte';
import {
	applyFogClasses,
	computeFocusNeighborMatch,
	computeMetadataMatch,
	computeFogMatchSet,
} from '$lib/filter/diagramFilter';

const nodes: Node[] = [
	{
		id: 'a',
		position: { x: 0, y: 0 },
		data: { calmId: 'a', metadata: { owner: 'platform' } },
	},
	{
		id: 'b',
		position: { x: 1, y: 0 },
		data: { calmId: 'b', metadata: { owner: 'platform' } },
	},
	{
		id: 'c',
		position: { x: 2, y: 0 },
		data: { calmId: 'c', metadata: { owner: 'risk' } },
	},
];

const edges: Edge[] = [
	{ id: 'e-ab', source: 'a', target: 'b' },
	{ id: 'e-bc', source: 'b', target: 'c' },
];

describe('diagramFilter', () => {
	test('focus neighbors matches 1-hop nodes and edges', () => {
		const match = computeFocusNeighborMatch(nodes, edges, 'a');
		expect(match.nodeIds.has('a')).toBe(true);
		expect(match.nodeIds.has('b')).toBe(true);
		expect(match.nodeIds.has('c')).toBe(false);
		expect(match.edgeIds.has('e-ab')).toBe(true);
		expect(match.edgeIds.has('e-bc')).toBe(false);
	});

	test('metadata match fogs non-matching nodes and edges', () => {
		const match = computeMetadataMatch(nodes, edges, ['owner'], 'platform');
		expect(match.nodeIds.has('a')).toBe(true);
		expect(match.nodeIds.has('b')).toBe(true);
		expect(match.nodeIds.has('c')).toBe(false);
		expect(match.edgeIds.has('e-ab')).toBe(true);
		expect(match.edgeIds.has('e-bc')).toBe(false);

		const fogged = applyFogClasses(nodes, edges, match);
		expect(fogged.nodes.find((n) => n.id === 'c')?.class).toContain('diagram-fogged');
		expect(fogged.edges.find((e) => e.id === 'e-bc')?.class).toContain('diagram-fogged');
		expect(fogged.nodes.find((n) => n.id === 'a')?.class ?? '').not.toContain('diagram-fogged');
	});

	test('applyFogClasses is referentially stable when fog state unchanged', () => {
		const match = computeFocusNeighborMatch(nodes, edges, 'a');
		const once = applyFogClasses(nodes, edges, match);
		const twice = applyFogClasses(once.nodes, once.edges, match);
		expect(twice.nodes).toBe(once.nodes);
		expect(twice.edges).toBe(once.edges);
	});

	test('computeFogMatchSet returns null when off', () => {
		expect(computeFogMatchSet({ mode: 'off' }, nodes, edges, 'a')).toBeNull();
	});

	test('node-type mode matches selected types and connecting edges', () => {
		const typed: Node[] = [
			{ id: 'a', position: { x: 0, y: 0 }, data: { calmId: 'a', calmType: 'service' } },
			{ id: 'b', position: { x: 1, y: 0 }, data: { calmId: 'b', calmType: 'service' } },
			{ id: 'c', position: { x: 2, y: 0 }, data: { calmId: 'c', calmType: 'database' } },
		];
		const match = computeFogMatchSet(
			{ mode: 'node-type', nodeTypes: ['service'] },
			typed,
			edges,
			null
		);
		expect(match?.nodeIds.has('a')).toBe(true);
		expect(match?.nodeIds.has('b')).toBe(true);
		expect(match?.nodeIds.has('c')).toBe(false);
		expect(match?.edgeIds.has('e-ab')).toBe(true);
		expect(match?.edgeIds.has('e-bc')).toBe(false);
	});
});
