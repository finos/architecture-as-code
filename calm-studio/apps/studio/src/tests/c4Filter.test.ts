// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import type { Node, Edge } from '@xyflow/svelte';
import {
	classifyNodeC4Level,
	isExternalNode,
	filterNodesForLevel,
	filterEdgesForVisibleNodes,
	getChildrenOf,
	hasDrillableChildren,
	applyC4Styles,
} from '$lib/c4/c4Filter';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeNode(id: string, calmType: string, extra: Partial<Node> = {}): Node {
	return {
		id,
		type: calmType,
		position: { x: 0, y: 0 },
		data: {
			label: id,
			calmType,
		},
		...extra,
	} as Node;
}

function makeNodeWithMeta(
	id: string,
	calmType: string,
	customMetadata: Record<string, string>,
	extra: Partial<Node> = {}
): Node {
	return {
		id,
		type: calmType,
		position: { x: 0, y: 0 },
		data: {
			label: id,
			calmType,
			customMetadata,
		},
		...extra,
	} as Node;
}

function makeEdge(id: string, source: string, target: string): Edge {
	return { id, source, target };
}

// ─── classifyNodeC4Level ─────────────────────────────────────────────────────

describe('classifyNodeC4Level', () => {
	it('returns context for actor', () => {
		expect(classifyNodeC4Level('actor')).toBe('context');
	});

	it('returns context for system', () => {
		expect(classifyNodeC4Level('system')).toBe('context');
	});

	it('returns context for ecosystem', () => {
		expect(classifyNodeC4Level('ecosystem')).toBe('context');
	});

	it('returns container for service', () => {
		expect(classifyNodeC4Level('service')).toBe('container');
	});

	it('returns container for database', () => {
		expect(classifyNodeC4Level('database')).toBe('container');
	});

	it('returns container for webclient', () => {
		expect(classifyNodeC4Level('webclient')).toBe('container');
	});

	it('returns container for network', () => {
		expect(classifyNodeC4Level('network')).toBe('container');
	});

	it('returns container for ldap', () => {
		expect(classifyNodeC4Level('ldap')).toBe('container');
	});

	it('returns container for data-asset', () => {
		expect(classifyNodeC4Level('data-asset')).toBe('container');
	});

	it('returns component for aws:lambda', () => {
		expect(classifyNodeC4Level('aws:lambda')).toBe('component');
	});

	it('returns component for k8s:pod', () => {
		expect(classifyNodeC4Level('k8s:pod')).toBe('component');
	});

	it('returns component for generic', () => {
		expect(classifyNodeC4Level('generic')).toBe('component');
	});

	it('returns component for unknown custom type', () => {
		expect(classifyNodeC4Level('my-custom-type')).toBe('component');
	});
});

// ─── isExternalNode ──────────────────────────────────────────────────────────

describe('isExternalNode', () => {
	it('returns true for ecosystem calmType', () => {
		const node = makeNode('eco-1', 'ecosystem');
		expect(isExternalNode(node)).toBe(true);
	});

	it('returns true for node with c4-scope=external in customMetadata', () => {
		const node = makeNodeWithMeta('sys-1', 'system', { 'c4-scope': 'external' });
		expect(isExternalNode(node)).toBe(true);
	});

	it('returns false for regular system node without external metadata', () => {
		const node = makeNode('sys-1', 'system');
		expect(isExternalNode(node)).toBe(false);
	});

	it('returns false for service node (container level, not external by type)', () => {
		const node = makeNode('svc-1', 'service');
		expect(isExternalNode(node)).toBe(false);
	});

	it('returns false when customMetadata is undefined', () => {
		const node = makeNode('sys-1', 'system');
		expect(isExternalNode(node)).toBe(false);
	});
});

// ─── filterNodesForLevel ─────────────────────────────────────────────────────

describe('filterNodesForLevel', () => {
	const actor = makeNode('actor-1', 'actor');
	const system = makeNode('sys-1', 'system');
	const service = makeNode('svc-1', 'service');
	const database = makeNode('db-1', 'database');
	const lambda = makeNode('fn-1', 'aws:lambda');
	// Context-type node but has a parentId (should be excluded at context level)
	const nestedSystem = makeNode('sys-nested', 'system', { parentId: 'sys-1' });

	const allNodes = [actor, system, service, database, lambda, nestedSystem];

	it('context level returns only context-type nodes with no parentId', () => {
		const result = filterNodesForLevel(allNodes, 'context', null);
		const ids = result.map((n) => n.id);
		expect(ids).toContain('actor-1');
		expect(ids).toContain('sys-1');
		expect(ids).not.toContain('svc-1');
		expect(ids).not.toContain('db-1');
		expect(ids).not.toContain('fn-1');
	});

	it('context level excludes nodes with parentId even if context type', () => {
		const result = filterNodesForLevel(allNodes, 'context', null);
		expect(result.map((n) => n.id)).not.toContain('sys-nested');
	});

	it('container level returns only container-type nodes with no parentId', () => {
		const result = filterNodesForLevel(allNodes, 'container', null);
		const ids = result.map((n) => n.id);
		expect(ids).toContain('svc-1');
		expect(ids).toContain('db-1');
		expect(ids).not.toContain('actor-1');
		expect(ids).not.toContain('sys-1');
		expect(ids).not.toContain('fn-1');
	});

	it('component level returns only component-type nodes with no parentId', () => {
		const result = filterNodesForLevel(allNodes, 'component', null);
		const ids = result.map((n) => n.id);
		expect(ids).toContain('fn-1');
		expect(ids).not.toContain('actor-1');
		expect(ids).not.toContain('svc-1');
	});

	it('with drillParentId returns only children of that parent', () => {
		const child1 = makeNode('child-1', 'service', { parentId: 'sys-1' });
		const child2 = makeNode('child-2', 'database', { parentId: 'sys-1' });
		const other = makeNode('other-1', 'service', { parentId: 'other-parent' });
		const nodes = [system, child1, child2, other];

		const result = filterNodesForLevel(nodes, 'container', 'sys-1');
		const ids = result.map((n) => n.id);
		expect(ids).toContain('child-1');
		expect(ids).toContain('child-2');
		expect(ids).not.toContain('sys-1');
		expect(ids).not.toContain('other-1');
	});
});

// ─── filterEdgesForVisibleNodes ───────────────────────────────────────────────

describe('filterEdgesForVisibleNodes', () => {
	const edge1 = makeEdge('edge-1', 'node-a', 'node-b');
	const edge2 = makeEdge('edge-2', 'node-a', 'node-c'); // node-c hidden
	const edge3 = makeEdge('edge-3', 'node-d', 'node-b'); // node-d hidden
	const edges = [edge1, edge2, edge3];

	it('includes edge where both source and target are visible', () => {
		const visible = new Set(['node-a', 'node-b']);
		const result = filterEdgesForVisibleNodes(edges, visible);
		expect(result.map((e) => e.id)).toContain('edge-1');
	});

	it('excludes edge where source is hidden', () => {
		const visible = new Set(['node-a', 'node-b']);
		const result = filterEdgesForVisibleNodes(edges, visible);
		expect(result.map((e) => e.id)).not.toContain('edge-3');
	});

	it('excludes edge where target is hidden', () => {
		const visible = new Set(['node-a', 'node-b']);
		const result = filterEdgesForVisibleNodes(edges, visible);
		expect(result.map((e) => e.id)).not.toContain('edge-2');
	});
});

// ─── getChildrenOf ───────────────────────────────────────────────────────────

describe('getChildrenOf', () => {
	const parent = makeNode('parent-1', 'system');
	const child1 = makeNode('child-1', 'service', { parentId: 'parent-1' });
	const child2 = makeNode('child-2', 'database', { parentId: 'parent-1' });
	const unrelated = makeNode('other-1', 'service', { parentId: 'other-parent' });
	const nodes = [parent, child1, child2, unrelated];

	it('returns nodes with matching parentId', () => {
		const result = getChildrenOf('parent-1', nodes);
		expect(result).toHaveLength(2);
		expect(result.map((n) => n.id)).toContain('child-1');
		expect(result.map((n) => n.id)).toContain('child-2');
	});

	it('does not include the parent itself', () => {
		const result = getChildrenOf('parent-1', nodes);
		expect(result.map((n) => n.id)).not.toContain('parent-1');
	});

	it('does not include unrelated nodes', () => {
		const result = getChildrenOf('parent-1', nodes);
		expect(result.map((n) => n.id)).not.toContain('other-1');
	});

	it('returns empty array when no children', () => {
		const result = getChildrenOf('no-children', nodes);
		expect(result).toHaveLength(0);
	});
});

// ─── hasDrillableChildren ────────────────────────────────────────────────────

describe('hasDrillableChildren', () => {
	const parent = makeNode('parent-1', 'system');
	const child = makeNode('child-1', 'service', { parentId: 'parent-1' });
	const noChildren = makeNode('leaf-1', 'service');
	const nodes = [parent, child, noChildren];

	it('returns true when node has children', () => {
		expect(hasDrillableChildren('parent-1', nodes)).toBe(true);
	});

	it('returns false when node has no children', () => {
		expect(hasDrillableChildren('leaf-1', nodes)).toBe(false);
	});

	it('returns false for unknown nodeId', () => {
		expect(hasDrillableChildren('unknown', nodes)).toBe(false);
	});
});

// ─── applyC4Styles ───────────────────────────────────────────────────────────

describe('applyC4Styles', () => {
	it('adds c4Level field to each node data', () => {
		const nodes = [makeNode('sys-1', 'system'), makeNode('actor-1', 'actor')];
		const result = applyC4Styles(nodes, 'context');
		result.forEach((n) => {
			expect(n.data.c4Level).toBe('context');
		});
	});

	it('adds c4External=true on ecosystem node', () => {
		const ecosystemNode = makeNode('eco-1', 'ecosystem');
		const result = applyC4Styles([ecosystemNode], 'context');
		expect(result[0].data.c4External).toBe(true);
	});

	it('adds c4External=true on node with c4-scope=external metadata', () => {
		const externalSys = makeNodeWithMeta('sys-ext', 'system', { 'c4-scope': 'external' });
		const result = applyC4Styles([externalSys], 'context');
		expect(result[0].data.c4External).toBe(true);
	});

	it('adds c4External=false on regular internal node', () => {
		const internalSys = makeNode('sys-int', 'system');
		const result = applyC4Styles([internalSys], 'context');
		expect(result[0].data.c4External).toBe(false);
	});

	it('does not mutate original nodes', () => {
		const original = makeNode('sys-1', 'system');
		const originalData = { ...original.data };
		applyC4Styles([original], 'context');
		expect(original.data).toEqual(originalData);
	});
});
