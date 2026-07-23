// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import type { CalmArchitecture } from '@calmstudio/calm-core';
import { layoutCalm } from '$lib/layout/elkLayout';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const twoNodeArch: CalmArchitecture = {
	nodes: [
		{ 'unique-id': 'svc-1', 'node-type': 'service', name: 'API', description: '' },
		{ 'unique-id': 'db-1', 'node-type': 'database', name: 'DB', description: '' },
	],
	relationships: [
		{
			'unique-id': 'rel-1',
			'relationship-type': { connects: { source: { node: 'svc-1' }, destination: { node: 'db-1' } } },
		},
	],
};

const threeNodeArch: CalmArchitecture = {
	nodes: [
		{ 'unique-id': 'a', 'node-type': 'actor', name: 'User', description: '' },
		{ 'unique-id': 'b', 'node-type': 'service', name: 'API', description: '' },
		{ 'unique-id': 'c', 'node-type': 'database', name: 'DB', description: '' },
	],
	relationships: [
		{ 'unique-id': 'r1', 'relationship-type': { connects: { source: { node: 'a' }, destination: { node: 'b' } } } },
		{ 'unique-id': 'r2', 'relationship-type': { connects: { source: { node: 'b' }, destination: { node: 'c' } } } },
	],
};

const emptyArch: CalmArchitecture = {
	nodes: [],
	relationships: [],
};

// ─── layoutCalm tests ─────────────────────────────────────────────────────────

describe('layoutCalm', () => {
	it('returns a Map with x/y positions for each node', async () => {
		const result = await layoutCalm(twoNodeArch, new Set());
		expect(result).toBeInstanceOf(Map);
		expect(result.size).toBe(2);
		for (const [id, pos] of result) {
			expect(typeof id).toBe('string');
			expect(typeof pos.x).toBe('number');
			expect(typeof pos.y).toBe('number');
		}
	});

	it('with empty pinnedIds includes all nodes in result', async () => {
		const result = await layoutCalm(threeNodeArch, new Set());
		expect(result.size).toBe(3);
		expect(result.has('a')).toBe(true);
		expect(result.has('b')).toBe(true);
		expect(result.has('c')).toBe(true);
	});

	it('with pinned IDs excludes pinned nodes from ELK result', async () => {
		const pinnedIds = new Set(['a']);
		const result = await layoutCalm(threeNodeArch, pinnedIds);
		// pinned nodes are NOT in returned map — caller handles pinned position injection
		expect(result.has('a')).toBe(false);
		expect(result.has('b')).toBe(true);
		expect(result.has('c')).toBe(true);
	});

	it('with direction RIGHT produces valid positionMap', async () => {
		const result = await layoutCalm(twoNodeArch, new Set(), 'RIGHT');
		expect(result).toBeInstanceOf(Map);
		expect(result.size).toBe(2);
		for (const pos of result.values()) {
			expect(typeof pos.x).toBe('number');
			expect(typeof pos.y).toBe('number');
		}
	});

	it('with empty architecture returns empty Map', async () => {
		const result = await layoutCalm(emptyArch, new Set());
		expect(result).toBeInstanceOf(Map);
		expect(result.size).toBe(0);
	});

	it('with long labels and size hints produces no sibling overlap', async () => {
		const arch: CalmArchitecture = {
			nodes: [
				{
					'unique-id': 'long-a',
					'node-type': 'service',
					name: 'Very Long Application Service Name Alpha',
					description: '',
				},
				{
					'unique-id': 'long-b',
					'node-type': 'service',
					name: 'Very Long Application Service Name Beta',
					description: '',
				},
				{
					'unique-id': 'long-c',
					'node-type': 'service',
					name: 'Very Long Application Service Name Gamma',
					description: '',
				},
			],
			relationships: [
				{
					'unique-id': 'r1',
					'relationship-type': {
						connects: { source: { node: 'long-a' }, destination: { node: 'long-b' } },
					},
				},
				{
					'unique-id': 'r2',
					'relationship-type': {
						connects: { source: { node: 'long-b' }, destination: { node: 'long-c' } },
					},
				},
			],
		};
		const hints = new Map([
			['long-a', { width: 320, height: 50 }],
			['long-b', { width: 320, height: 50 }],
			['long-c', { width: 320, height: 50 }],
		]);
		const result = await layoutCalm(arch, new Set(), 'DOWN', hints);
		const ids = ['long-a', 'long-b', 'long-c'];
		const gap = 28;
		for (let i = 0; i < ids.length; i++) {
			for (let j = i + 1; j < ids.length; j++) {
				const a = result.get(ids[i])!;
				const b = result.get(ids[j])!;
				const aw = a.width ?? 320;
				const ah = a.height ?? 50;
				const bw = b.width ?? 320;
				const bh = b.height ?? 50;
				const pad = gap / 2;
				const overlapX =
					Math.min(a.x + aw + pad, b.x + bw + pad) - Math.max(a.x - pad, b.x - pad);
				const overlapY =
					Math.min(a.y + ah + pad, b.y + bh + pad) - Math.max(a.y - pad, b.y - pad);
				expect(overlapX <= 0 || overlapY <= 0).toBe(true);
			}
		}
	});
});
