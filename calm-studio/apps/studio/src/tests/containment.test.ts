// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, test, expect } from 'vitest';
import type { Node } from '@xyflow/svelte';
import { makeContainment, removeContainment, isContainmentType, ensureContainmentEdge, applyContainmentFromEdges, CONTAINER_DEFAULT_WIDTH, CONTAINER_DEFAULT_HEIGHT } from '$lib/canvas/containment';

// ─── Fixtures ───────────────────────────────────────────────────────────────

function makeNode(
	id: string,
	type = 'service',
	extra: Partial<Node> = {}
): Node {
	return {
		id,
		type,
		position: { x: 0, y: 0 },
		data: { label: id },
		...extra,
	} as Node;
}

// ─── makeContainment ─────────────────────────────────────────────────────────

describe('makeContainment', () => {
	test('sets parentId on child node', () => {
		const parent = makeNode('parent-1', 'container');
		const child = makeNode('child-1', 'service');
		const nodes = [parent, child];

		const result = makeContainment('parent-1', 'child-1', nodes);

		const updatedChild = result.find((n) => n.id === 'child-1')!;
		expect(updatedChild.parentId).toBe('parent-1');
	});

	test('sets extent:"parent" on child node', () => {
		const parent = makeNode('parent-1', 'container');
		const child = makeNode('child-1', 'service');

		const result = makeContainment('parent-1', 'child-1', [parent, child]);

		const updatedChild = result.find((n) => n.id === 'child-1')!;
		expect(updatedChild.extent).toBe('parent');
	});

	test('converts parent to container type if not already a container', () => {
		const parent = makeNode('parent-1', 'system', { width: 120, height: 60 });
		const child = makeNode('child-1', 'service');

		const result = makeContainment('parent-1', 'child-1', [parent, child]);

		const updatedParent = result.find((n) => n.id === 'parent-1')!;
		expect(updatedParent.type).toBe('container');
		expect(updatedParent.width).toBe(CONTAINER_DEFAULT_WIDTH);
		expect(updatedParent.height).toBe(CONTAINER_DEFAULT_HEIGHT);
	});

	test('converts absolute child position to parent-relative when nesting', () => {
		const parent = makeNode('parent-1', 'system', { position: { x: 100, y: 100 }, width: 120, height: 60 });
		const child = makeNode('child-1', 'service', { position: { x: 400, y: 120 } });

		const result = makeContainment('parent-1', 'child-1', [parent, child]);

		const updatedChild = result.find((n) => n.id === 'child-1')!;
		expect(updatedChild.parentId).toBe('parent-1');
		expect(updatedChild.position.x).toBeLessThan(CONTAINER_DEFAULT_WIDTH);
		expect(updatedChild.position.y).toBeGreaterThanOrEqual(40);
	});

	test('leaves parent type unchanged when already a container', () => {
		const parent = makeNode('parent-1', 'container');
		const child = makeNode('child-1', 'service');

		const result = makeContainment('parent-1', 'child-1', [parent, child]);

		const updatedParent = result.find((n) => n.id === 'parent-1')!;
		expect(updatedParent.type).toBe('container');
	});

	test('sets zIndex on child for click-through in nested containers', () => {
		const vpc = makeNode('vpc', 'container');
		const subnet = makeNode('subnet', 'service');

		const result = makeContainment('vpc', 'subnet', [vpc, subnet]);

		const child = result.find((n) => n.id === 'subnet')!;
		expect(child.zIndex).toBe(1);
	});

	test('sets higher zIndex for deeply nested children', () => {
		const vpc = makeNode('vpc', 'container');
		const subnet = makeNode('subnet', 'container', { parentId: 'vpc', extent: 'parent' as const });
		const ec2 = makeNode('ec2', 'extension');

		const result = makeContainment('subnet', 'ec2', [vpc, subnet, ec2]);

		const child = result.find((n) => n.id === 'ec2')!;
		expect(child.zIndex).toBe(2);
	});

	test('does not mutate the original nodes array', () => {
		const parent = makeNode('parent-1', 'container');
		const child = makeNode('child-1', 'service');
		const nodes = [parent, child];
		const original = [...nodes];

		makeContainment('parent-1', 'child-1', nodes);

		// Array reference and contents should be unchanged
		expect(nodes).toHaveLength(original.length);
		expect(nodes[0]).toBe(parent);
		expect(nodes[1]).toBe(child);
	});
});

// ─── removeContainment ───────────────────────────────────────────────────────

describe('removeContainment', () => {
	test('clears parentId from child node', () => {
		const parent = makeNode('parent-1', 'container');
		const child = makeNode('child-1', 'service', { parentId: 'parent-1', extent: 'parent' });
		const nodes = [parent, child];

		const result = removeContainment('child-1', nodes);

		const updatedChild = result.find((n) => n.id === 'child-1')!;
		expect(updatedChild.parentId).toBeUndefined();
	});

	test('clears extent from child node', () => {
		const parent = makeNode('parent-1', 'container');
		const child = makeNode('child-1', 'service', { parentId: 'parent-1', extent: 'parent' });

		const result = removeContainment('child-1', [parent, child]);

		const updatedChild = result.find((n) => n.id === 'child-1')!;
		expect(updatedChild.extent).toBeUndefined();
	});

	test('does not affect other nodes', () => {
		const parent = makeNode('parent-1', 'container');
		const child1 = makeNode('child-1', 'service', { parentId: 'parent-1', extent: 'parent' });
		const child2 = makeNode('child-2', 'service', { parentId: 'parent-1', extent: 'parent' });

		const result = removeContainment('child-1', [parent, child1, child2]);

		const updatedChild2 = result.find((n) => n.id === 'child-2')!;
		expect(updatedChild2.parentId).toBe('parent-1');
		expect(updatedChild2.extent).toBe('parent');
	});
});

// ─── isContainmentType ───────────────────────────────────────────────────────

describe('isContainmentType', () => {
	test('returns true for deployed-in', () => {
		expect(isContainmentType('deployed-in')).toBe(true);
	});

	test('returns true for composed-of', () => {
		expect(isContainmentType('composed-of')).toBe(true);
	});

	test('returns false for connects', () => {
		expect(isContainmentType('connects')).toBe(false);
	});

	test('returns false for interacts', () => {
		expect(isContainmentType('interacts')).toBe(false);
	});

	test('returns false for options', () => {
		expect(isContainmentType('options')).toBe(false);
	});

	test('returns false for unknown strings', () => {
		expect(isContainmentType('unknown-type')).toBe(false);
	});
});

describe('ensureContainmentEdge', () => {
	test('adds composed-of edge when missing', () => {
		const edges = ensureContainmentEdge('parent', 'child', []);
		expect(edges).toHaveLength(1);
		expect(edges[0].source).toBe('parent');
		expect(edges[0].target).toBe('child');
		expect(edges[0].type).toBe('composed-of');
	});

	test('does not duplicate existing edge', () => {
		const initial = ensureContainmentEdge('parent', 'child', []);
		const again = ensureContainmentEdge('parent', 'child', initial);
		expect(again).toHaveLength(1);
	});
});

describe('applyContainmentFromEdges', () => {
	test('enlarges parent when composed-of edge exists', () => {
		const parent = makeNode('parent-1', 'service', { width: 120, height: 60 });
		const child = makeNode('child-1', 'service', { position: { x: 300, y: 0 } });
		const edges = [
			{ id: 'e1', source: 'parent-1', target: 'child-1', type: 'composed-of', data: {} },
		] as import('@xyflow/svelte').Edge[];

		const result = applyContainmentFromEdges([parent, child], edges);
		const updatedParent = result.find((n) => n.id === 'parent-1')!;
		expect(updatedParent.type).toBe('container');
		expect(updatedParent.width).toBe(CONTAINER_DEFAULT_WIDTH);
		expect(updatedParent.height).toBe(CONTAINER_DEFAULT_HEIGHT);
	});

	test('applies deployed-in containment', () => {
		const parent = makeNode('host-1', 'system', { width: 80, height: 40 });
		const child = makeNode('app-1', 'service', { position: { x: 500, y: 50 } });
		const edges = [
			{ id: 'e1', source: 'host-1', target: 'app-1', type: 'deployed-in', data: {} },
		] as import('@xyflow/svelte').Edge[];

		const result = applyContainmentFromEdges([parent, child], edges);
		const updatedChild = result.find((n) => n.id === 'app-1')!;
		expect(updatedChild.parentId).toBe('host-1');
		expect(result.find((n) => n.id === 'host-1')!.type).toBe('container');
	});

	test('ignores non-containment edges', () => {
		const a = makeNode('a', 'service');
		const b = makeNode('b', 'service');
		const edges = [
			{ id: 'e1', source: 'a', target: 'b', type: 'connects', data: {} },
		] as import('@xyflow/svelte').Edge[];

		const result = applyContainmentFromEdges([a, b], edges);
		expect(result.find((n) => n.id === 'b')!.parentId).toBeUndefined();
		expect(result.find((n) => n.id === 'a')!.type).toBe('service');
	});

	test('uses measured dimensions when larger than container defaults', () => {
		const parent = makeNode('parent-1', 'system', {
			width: 100,
			height: 50,
			measured: { width: 400, height: 280 },
		});
		const child = makeNode('child-1', 'service');
		const edges = [
			{ id: 'e1', source: 'parent-1', target: 'child-1', type: 'composed-of', data: {} },
		] as import('@xyflow/svelte').Edge[];

		const result = applyContainmentFromEdges([parent, child], edges);
		const updatedParent = result.find((n) => n.id === 'parent-1')!;
		expect(updatedParent.width).toBe(400);
		expect(updatedParent.height).toBe(280);
	});

	test('clamps small measured dimensions to container defaults', () => {
		const parent = makeNode('parent-1', 'system', {
			width: 100,
			height: 50,
			measured: { width: 250, height: 180 },
		});
		const child = makeNode('child-1', 'service');
		const edges = [
			{ id: 'e1', source: 'parent-1', target: 'child-1', type: 'composed-of', data: {} },
		] as import('@xyflow/svelte').Edge[];

		const result = applyContainmentFromEdges([parent, child], edges);
		const updatedParent = result.find((n) => n.id === 'parent-1')!;
		expect(updatedParent.width).toBe(CONTAINER_DEFAULT_WIDTH);
		expect(updatedParent.height).toBe(CONTAINER_DEFAULT_HEIGHT);
	});

	test('applies multiple containment edges in sequence', () => {
		const root = makeNode('root', 'system', { width: 120, height: 60 });
		const child1 = makeNode('c1', 'service');
		const child2 = makeNode('c2', 'service');
		const edges = [
			{ id: 'e1', source: 'root', target: 'c1', type: 'composed-of', data: {} },
			{ id: 'e2', source: 'root', target: 'c2', type: 'composed-of', data: {} },
		] as import('@xyflow/svelte').Edge[];

		const result = applyContainmentFromEdges([root, child1, child2], edges);
		expect(result.find((n) => n.id === 'c1')!.parentId).toBe('root');
		expect(result.find((n) => n.id === 'c2')!.parentId).toBe('root');
	});
});
