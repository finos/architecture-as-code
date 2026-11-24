// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { registerPack, unregisterPack } from '@calmstudio/extensions';
import {
	fieldsForDrawnRelationship,
	storedRelationshipTypeKey,
} from '$lib/relationships/relationshipTypeChoice';

describe('palette relationship draw', () => {
	it('stores the pack marker and not the line color', () => {
		registerPack({
			id: 'difa-arch',
			label: 'DIFA',
			version: '1.1.0',
			color: { bg: '#ffffff', border: '#000000', stroke: '#000000' },
			nodes: [],
			relationships: [
				{
					typeId: 'difa-arch:impacts-new',
					label: 'Impacts: New',
					calmCoreVariant: 'connects',
					'line-style': 'solid',
					'line-color': '#dc2626',
					defaults: {
						metadata: {
							'difa-arch': {
								relationship: 'impacts-new',
								'calm-core-variant': 'connects',
							},
						},
					},
				},
			],
		});
		try {
			const drawn = fieldsForDrawnRelationship('difa-arch:impacts-new', 'a', 'b', {
				'difa-arch': { relationship: 'association', 'calm-core-variant': 'connects' },
				owner: 'platform',
			});
			expect(drawn.canvasVariant).toBe('connects');
			expect(drawn.relationshipTypeKey).toBe('difa-arch:impacts-new');
			expect(drawn.hidden).toBe(false);
			expect(drawn.metadata?.owner).toBe('platform');
			expect(drawn.metadata?.['difa-arch']).toEqual({
				relationship: 'impacts-new',
				'calm-core-variant': 'connects',
			});
			expect(drawn.metadata?.['line-color']).toBeUndefined();
			expect(
				storedRelationshipTypeKey(
					{ connects: { source: { node: 'a' }, destination: { node: 'b' } } },
					drawn.metadata,
				),
			).toBe('difa-arch:impacts-new');
		} finally {
			unregisterPack('difa-arch');
		}
	});

	it('draws a core containment type without replacing unrelated metadata', () => {
		const drawn = fieldsForDrawnRelationship('composed-of', 'parent', 'child', {
			owner: 'platform',
		});
		expect(drawn.canvasVariant).toBe('composed-of');
		expect(drawn.hidden).toBe(true);
		expect(drawn.metadata?.owner).toBe('platform');
	});

	it('keeps scaffold metadata for the default connects type', () => {
		const drawn = fieldsForDrawnRelationship('connects', 'a', 'b', {
			archimate: { relationship: 'Association', 'calm-core-variant': 'connects' },
		});
		expect(drawn.canvasVariant).toBe('connects');
		expect(drawn.metadata?.archimate).toEqual({
			relationship: 'Association',
			'calm-core-variant': 'connects',
		});
	});
});
