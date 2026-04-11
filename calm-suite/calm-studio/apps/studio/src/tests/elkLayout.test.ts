// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import type { CalmArchitecture } from '@calmstudio/calm-core';
import { layoutCalm } from '$lib/layout/elkLayout';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const twoNodeArch: CalmArchitecture = {
	nodes: [
		{ 'unique-id': 'svc-1', 'node-type': 'service', name: 'API' },
		{ 'unique-id': 'db-1', 'node-type': 'database', name: 'DB' },
	],
	relationships: [
		{
			'unique-id': 'rel-1',
			'relationship-type': 'connects',
			source: 'svc-1',
			destination: 'db-1',
		},
	],
};

const threeNodeArch: CalmArchitecture = {
	nodes: [
		{ 'unique-id': 'a', 'node-type': 'actor', name: 'User' },
		{ 'unique-id': 'b', 'node-type': 'service', name: 'API' },
		{ 'unique-id': 'c', 'node-type': 'database', name: 'DB' },
	],
	relationships: [
		{ 'unique-id': 'r1', 'relationship-type': 'connects', source: 'a', destination: 'b' },
		{ 'unique-id': 'r2', 'relationship-type': 'connects', source: 'b', destination: 'c' },
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
});
