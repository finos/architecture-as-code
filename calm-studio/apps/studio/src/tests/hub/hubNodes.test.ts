// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { registerPack, unregisterPack } from '@calmstudio/extensions';
import { hubNodesFromArchitecture, nodeTypeIconMarkup } from '$lib/hub/hubNodes';

describe('hubNodesFromArchitecture', () => {
	it('lists node name, type, and id', () => {
		expect(
			hubNodesFromArchitecture({
				nodes: [
					{
						'unique-id': 'coa',
						name: 'COA',
						'node-type': 'system',
						description: 'Core',
					},
				],
			})
		).toEqual([
			{ uniqueId: 'coa', name: 'COA', nodeType: 'system', description: 'Core' },
		]);
	});

	it('keeps detailed-architecture when the hub node is a reference', () => {
		expect(
			hubNodesFromArchitecture({
				nodes: [
					{
						'unique-id': 'coa',
						name: 'COA',
						'node-type': 'system',
						description: '',
						details: { 'detailed-architecture': 'https://hub.example/calm/coa' },
					},
				],
			})[0]?.detailedArchitecture
		).toBe('https://hub.example/calm/coa');
	});

	it('returns an empty list when the document has no nodes', () => {
		expect(hubNodesFromArchitecture({})).toEqual([]);
	});
});

describe('nodeTypeIconMarkup', () => {
	it('returns the core pack icon for an unprefixed type', () => {
		expect(nodeTypeIconMarkup('service')).toContain('<svg');
		expect(nodeTypeIconMarkup('system')).toContain('<svg');
	});

	it('returns a pack icon for a colon-prefixed type', () => {
		registerPack({
			id: 'difa-arch',
			label: 'DIFA',
			version: '1',
			color: { bg: '#fff', border: '#000', stroke: '#000' },
			nodes: [
				{
					typeId: 'difa-arch:application-component',
					label: 'Application Component',
					icon: '<svg id="app"/>',
					color: { bg: '#fff', border: '#000', stroke: '#000' },
				},
			],
			relationships: [],
		});
		expect(nodeTypeIconMarkup('difa-arch:application-component')).toBe('<svg id="app"/>');
		unregisterPack('difa-arch');
	});

	it('returns an empty string when the type has no icon', () => {
		expect(nodeTypeIconMarkup('not-a-type')).toBe('');
	});
});
