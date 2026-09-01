// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, test } from 'vitest';
import type { CalmArchitecture } from '@calmstudio/calm-core';
import { collectUsageHits } from '$lib/usage/findUsage';

const focus = 'api-gateway';

const otherFile: CalmArchitecture = {
	nodes: [
		{
			'unique-id': 'api-gateway',
			'node-type': 'system',
			name: 'API Gateway',
			description: '',
			details: { 'detailed-architecture': '../components/api-gateway.json' },
		},
		{
			'unique-id': 'billing',
			'node-type': 'service',
			name: 'Billing',
			description: '',
		},
	],
	relationships: [
		{
			'unique-id': 'rel-connects',
			'relationship-type': {
				connects: { source: { node: 'billing' }, destination: { node: 'api-gateway' } },
			},
		},
		{
			'unique-id': 'rel-compose',
			'relationship-type': {
				'composed-of': { container: 'platform', nodes: ['api-gateway'] },
			},
		},
	],
};

describe('collectUsageHits', () => {
	test('finds reference stubs and relationship endpoints', () => {
		const hits = collectUsageHits(otherFile, focus, 'overview.json');
		expect(hits.some((h) => h.kind === 'node' && h.uniqueId === focus)).toBe(true);
		expect(hits.some((h) => h.kind === 'relationship' && h.uniqueId === 'rel-connects')).toBe(
			true
		);
		expect(hits.some((h) => h.kind === 'relationship' && h.uniqueId === 'rel-compose')).toBe(true);
	});

	test('ignores a home node without detailed-architecture', () => {
		const home: CalmArchitecture = {
			nodes: [
				{
					'unique-id': focus,
					'node-type': 'system',
					name: 'API Gateway',
					description: 'canonical',
				},
			],
			relationships: [],
		};
		expect(collectUsageHits(home, focus, 'home.json')).toEqual([]);
	});

	test('ignores unrelated files', () => {
		const unrelated: CalmArchitecture = {
			nodes: [{ 'unique-id': 'other', 'node-type': 'service', name: 'X', description: '' }],
			relationships: [],
		};
		expect(collectUsageHits(unrelated, focus, 'x.json')).toEqual([]);
	});
});
