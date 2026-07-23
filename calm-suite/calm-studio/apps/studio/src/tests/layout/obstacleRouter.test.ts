// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import {
	routeEdgeOrthogonal,
	segmentIntersectsRect,
	collectNodeObstacles,
	resolveSiblingOverlaps,
	siblingsHaveOverlap,
} from '../../lib/canvas/edgeRouting/obstacleRouter';
import { duplicateRelationshipsForNode } from '../../lib/canvas/duplicateRelationships';
import type { CalmArchitecture } from '@calmstudio/calm-core';

describe('obstacleRouter', () => {
	it('routes around an intermediate obstacle', () => {
		const result = routeEdgeOrthogonal({
			source: { x: 0, y: 50, position: 'right' },
			target: { x: 300, y: 50, position: 'left' },
			obstacles: [{ id: 'mid', x: 100, y: 20, width: 80, height: 60 }],
			padding: 8,
		});
		expect(result.path.startsWith('M ')).toBe(true);
		expect(result.intersectionCount).toBe(0);
	});

	it('detects segment/rect intersection', () => {
		expect(
			segmentIntersectsRect(
				{ x: 0, y: 50 },
				{ x: 200, y: 50 },
				{ id: 'a', x: 50, y: 0, width: 50, height: 100 }
			)
		).toBe(true);
		expect(
			segmentIntersectsRect(
				{ x: 0, y: 0 },
				{ x: 200, y: 0 },
				{ id: 'a', x: 50, y: 20, width: 50, height: 100 }
			)
		).toBe(false);
	});

	it('excludes source/target from obstacles', () => {
		const nodes = [
			{ id: 'a', position: { x: 0, y: 0 }, width: 100, height: 50 },
			{ id: 'b', position: { x: 200, y: 0 }, width: 100, height: 50 },
			{ id: 'c', position: { x: 80, y: 0 }, width: 40, height: 50 },
		];
		const obstacles = collectNodeObstacles(nodes, new Set(['a', 'b']));
		expect(obstacles.map((o) => o.id)).toEqual(['c']);
	});

	it('resolves overlapping sibling positions', () => {
		const positions = new Map([
			['a', { x: 0, y: 0, width: 100, height: 50 }],
			['b', { x: 40, y: 10, width: 100, height: 50 }],
		]);
		const resolved = resolveSiblingOverlaps(positions, ['a', 'b'], 16);
		const a = resolved.get('a')!;
		const b = resolved.get('b')!;
		const overlapX = Math.min(a.x + 100, b.x + 100) - Math.max(a.x, b.x);
		const overlapY = Math.min(a.y + 50, b.y + 50) - Math.max(a.y, b.y);
		expect(overlapX <= 0 || overlapY <= 0).toBe(true);
	});

	it('keeps required gap between siblings', () => {
		const positions = new Map([
			['a', { x: 0, y: 0, width: 100, height: 50 }],
			['b', { x: 90, y: 0, width: 100, height: 50 }],
		]);
		const gap = 24;
		const resolved = resolveSiblingOverlaps(positions, ['a', 'b'], gap);
		expect(siblingsHaveOverlap(resolved, ['a', 'b'], gap)).toBe(false);
	});
});

describe('duplicateRelationshipsForNode', () => {
	it('clones and rewires connects relationships', () => {
		const arch: CalmArchitecture = {
			nodes: [
				{ 'unique-id': 'a', 'node-type': 'service', name: 'A', description: '' },
				{ 'unique-id': 'b', 'node-type': 'service', name: 'B', description: '' },
			],
			relationships: [
				{
					'unique-id': 'r1',
					'relationship-type': {
						connects: {
							source: { node: 'a' },
							destination: { node: 'b' },
						},
					},
				},
			],
		};
		const clones = duplicateRelationshipsForNode(arch, 'a', 'a-copy');
		expect(clones).toHaveLength(1);
		expect(clones[0]['unique-id']).not.toBe('r1');
		const rt = clones[0]['relationship-type'];
		expect('connects' in rt && rt.connects.source.node).toBe('a-copy');
		expect('connects' in rt && rt.connects.destination.node).toBe('b');
	});
});
