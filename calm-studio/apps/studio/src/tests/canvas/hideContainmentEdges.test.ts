// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, test } from 'vitest';
import type { Node, Edge } from '@xyflow/svelte';
import { syncContainmentRelData } from '$lib/canvas/containment';

describe('syncContainmentRelData', () => {
	test('attaches unique containment rels onto the container node', () => {
		const nodes: Node[] = [
			{ id: 'parent', type: 'container', position: { x: 0, y: 0 }, data: { label: 'P' } },
			{ id: 'child', position: { x: 10, y: 10 }, data: { label: 'C' }, parentId: 'parent' },
		];
		const edges: Edge[] = [
			{
				id: 'rel-1',
				source: 'parent',
				target: 'child',
				type: 'composed-of',
				hidden: true,
				data: { calmRelId: 'rel-1' },
			},
		];
		const next = syncContainmentRelData(nodes, edges);
		expect(next.find((n) => n.id === 'parent')?.data?.containmentRels).toEqual([
			{ uniqueId: 'rel-1', name: 'rel-1', variant: 'composed-of' },
		]);
	});
});
