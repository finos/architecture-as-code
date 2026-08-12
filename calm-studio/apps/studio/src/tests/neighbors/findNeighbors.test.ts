// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, test } from 'vitest';
import type { CalmArchitecture } from '@calmstudio/calm-core';
import {
	collectNeighborsFromArchitecture,
	dedupeNeighborHits,
	directionFor,
	expandHitsForNeighborIds,
	filterNeighborHits,
	isPathUnderSearchRoots,
} from '$lib/neighbors/findNeighbors';
import { addNeighborsToCanvas } from '$lib/neighbors/addNeighbors';
import type { Node, Edge } from '@xyflow/svelte';

const arch: CalmArchitecture = {
	nodes: [
		{
			'unique-id': 'svc-a',
			'node-type': 'service',
			name: 'Service A',
			description: 'A',
		},
		{
			'unique-id': 'db-b',
			'node-type': 'database',
			name: 'DB B',
			description: 'B',
		},
		{
			'unique-id': 'svc-c',
			'node-type': 'service',
			name: 'Service C',
			description: 'C',
		},
	],
	relationships: [
		{
			'unique-id': 'rel-ab',
			'relationship-type': {
				connects: {
					source: { node: 'svc-a' },
					destination: { node: 'db-b' },
				},
			},
		},
		{
			'unique-id': 'rel-ca',
			'relationship-type': {
				connects: {
					source: { node: 'svc-c' },
					destination: { node: 'svc-a' },
				},
			},
		},
		{
			'unique-id': 'rel-ab-2',
			'relationship-type': {
				interacts: {
					actor: 'svc-a',
					nodes: ['db-b'],
				},
			},
		},
	],
};

describe('findNeighbors', () => {
	test('collectNeighborsFromArchitecture returns inbound and outbound 1-hop peers', () => {
		const hits = collectNeighborsFromArchitecture(arch, 'svc-a', 'other/svc.json');
		expect(hits.length).toBeGreaterThanOrEqual(2);
		const ids = [...new Set(hits.map((h) => h.neighborUniqueId))].sort();
		expect(ids).toEqual(['db-b', 'svc-c']);
		const out = hits.find((h) => h.relationshipUniqueId === 'rel-ab');
		expect(out?.direction).toBe('out');
		const inn = hits.find((h) => h.relationshipUniqueId === 'rel-ca');
		expect(inn?.direction).toBe('in');
	});

	test('lists every distinct relationship where focus is source (out)', () => {
		const hits = collectNeighborsFromArchitecture(arch, 'svc-a', 'other/svc.json');
		const outbound = hits.filter((h) => h.direction === 'out');
		expect(outbound.map((h) => h.relationshipUniqueId).sort()).toEqual([
			'rel-ab',
			'rel-ab-2',
		]);
	});

	test('directionFor marks interacts actor as out', () => {
		const rel = arch.relationships[2]!;
		expect(directionFor(rel, 'svc-a', 'db-b')).toBe('out');
		expect(directionFor(rel, 'db-b', 'svc-a')).toBe('in');
	});

	test('resolves neighbor from project index when missing in relationship file', () => {
		const relOnly: CalmArchitecture = {
			nodes: [{ 'unique-id': 'svc-a', 'node-type': 'service', name: 'A', description: '' }],
			relationships: [
				{
					'unique-id': 'rel-cross',
					'relationship-type': {
						connects: {
							source: { node: 'svc-a' },
							destination: { node: 'remote-x' },
						},
					},
				},
			],
		};
		const index = new Map([
			[
				'remote-x',
				{
					node: {
						'unique-id': 'remote-x',
						'node-type': 'database',
						name: 'Remote X',
						description: '',
					},
					relativePath: 'other/remote.json',
				},
			],
		]);
		const hits = collectNeighborsFromArchitecture(relOnly, 'svc-a', 'here.json', index);
		expect(hits).toHaveLength(1);
		expect(hits[0]!.neighborName).toBe('Remote X');
		expect(hits[0]!.neighborHomePath).toBe('other/remote.json');
		expect(hits[0]!.direction).toBe('out');
	});

	test('filterNeighborHits filters by node-type and relationship-type', () => {
		const hits = collectNeighborsFromArchitecture(arch, 'svc-a', 'other/svc.json');
		const filtered = filterNeighborHits(hits, {
			nodeTypes: new Set(['database']),
			relationshipTypes: new Set(['connects']),
		});
		expect(filtered.every((h) => h.neighborUniqueId === 'db-b')).toBe(true);
		expect(filtered.every((h) => h.relationshipType === 'connects')).toBe(true);
	});

	test('dedupeNeighborHits keeps one row per relationship+neighbor', () => {
		const hits = [
			...collectNeighborsFromArchitecture(arch, 'svc-a', 'a/svc.json'),
			...collectNeighborsFromArchitecture(arch, 'svc-a', 'b/svc.json'),
		];
		const deduped = dedupeNeighborHits(hits);
		const keys = deduped.map((h) => `${h.relationshipUniqueId}::${h.neighborUniqueId}`);
		expect(keys).toEqual([...new Set(keys)]);
		// Both outbound edges to db-b must remain
		expect(
			deduped.filter((h) => h.neighborUniqueId === 'db-b' && h.direction === 'out')
		).toHaveLength(2);
	});

	test('expandHitsForNeighborIds restores all relationships for selected neighbors', () => {
		const hits = collectNeighborsFromArchitecture(arch, 'svc-a', 'other/svc.json');
		const expanded = expandHitsForNeighborIds(hits, ['db-b']);
		expect(expanded.every((h) => h.neighborUniqueId === 'db-b')).toBe(true);
		expect(expanded.some((h) => h.relationshipUniqueId === 'rel-ab')).toBe(true);
	});

	test('isPathUnderSearchRoots matches folder and subfolders', () => {
		expect(isPathUnderSearchRoots('components/a.json', ['components'])).toBe(true);
		expect(isPathUnderSearchRoots('components/x/a.json', ['components'])).toBe(true);
		expect(isPathUnderSearchRoots('external/a.json', ['components'])).toBe(false);
		expect(isPathUnderSearchRoots('external/a.json', [])).toBe(true);
	});
});

describe('addNeighborsToCanvas', () => {
	test('adds reference node and relationship with same unique-id', () => {
		const nodes: Node[] = [
			{
				id: 'svc-a',
				position: { x: 0, y: 0 },
				data: { calmId: 'svc-a', calmType: 'service', label: 'Service A' },
			},
		];
		const edges: Edge[] = [];
		const hits = collectNeighborsFromArchitecture(arch, 'svc-a', 'other/svc.json').filter(
			(h) => h.relationshipUniqueId === 'rel-ab'
		);

		const result = addNeighborsToCanvas({
			hits,
			nodes,
			edges,
			focusUniqueId: 'svc-a',
			currentRelativePath: 'overview.json',
		});

		expect(result.addedNodeIds).toContain('db-b');
		const ref = result.nodes.find((n) => n.id === 'db-b');
		expect(ref?.data?.isReference).toBe(true);
		expect(
			(ref?.data?.calmDetails as Record<string, string>)?.['detailed-architecture']
		).toBe('other/svc.json');
		expect(result.edges.some((e) => e.id === 'rel-ab')).toBe(true);
	});

	test('when neighbor already on canvas, only adds missing relationship', () => {
		const nodes: Node[] = [
			{
				id: 'svc-a',
				position: { x: 0, y: 0 },
				data: { calmId: 'svc-a', calmType: 'service', label: 'Service A' },
			},
			{
				id: 'db-b',
				position: { x: 100, y: 0 },
				data: {
					calmId: 'db-b',
					calmType: 'database',
					label: 'DB B',
					isReference: true,
					calmDetails: { 'detailed-architecture': 'other/svc.json' },
				},
			},
		];
		const edges: Edge[] = [];
		const hits = collectNeighborsFromArchitecture(arch, 'svc-a', 'other/svc.json').filter(
			(h) => h.relationshipUniqueId === 'rel-ab'
		);

		const result = addNeighborsToCanvas({
			hits,
			nodes,
			edges,
			focusUniqueId: 'svc-a',
			currentRelativePath: 'overview.json',
		});

		expect(result.addedNodeIds).toHaveLength(0);
		expect(result.addedEdgeIds).toContain('rel-ab');
		expect(result.nodes.filter((n) => n.id === 'db-b')).toHaveLength(1);
	});

	test('is idempotent when relationship unique-id already present', () => {
		const nodes: Node[] = [
			{
				id: 'svc-a',
				position: { x: 0, y: 0 },
				data: { calmId: 'svc-a', calmType: 'service', label: 'A' },
			},
			{
				id: 'db-b',
				position: { x: 100, y: 0 },
				data: { calmId: 'db-b', calmType: 'database', label: 'B' },
			},
		];
		const edges: Edge[] = [
			{
				id: 'rel-ab',
				source: 'svc-a',
				target: 'db-b',
				data: { calmRelId: 'rel-ab', calmVariant: 'connects' },
			},
		];
		const hits = collectNeighborsFromArchitecture(arch, 'svc-a', 'other/svc.json').filter(
			(h) => h.relationshipUniqueId === 'rel-ab'
		);

		const result = addNeighborsToCanvas({
			hits,
			nodes,
			edges,
			focusUniqueId: 'svc-a',
			currentRelativePath: 'overview.json',
		});

		expect(result.addedNodeIds).toHaveLength(0);
		expect(result.addedEdgeIds).toHaveLength(0);
		expect(result.edges).toHaveLength(1);
	});
});
