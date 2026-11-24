// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { registerPack, unregisterPack } from '@calmstudio/extensions';
import { replaceTypeBoundMetadata } from '$lib/relationships/relationshipTypeChoice';

describe('replaceTypeBoundMetadata', () => {
	it('writes the ArchiMate type marker and keeps unrelated keys', () => {
		const next = replaceTypeBoundMetadata(
			{ owner: 'platform', archimate: { relationship: 'flow', note: 'keep' } },
			'archimate:flow',
			'archimate:serving',
			'connects',
		);
		expect(next?.owner).toBe('platform');
		expect(next?.archimate).toMatchObject({
			relationship: 'serving',
			'calm-core-variant': 'connects',
			note: 'keep',
		});
	});

	it('clears the ArchiMate relationship name when the new type is a core variant', () => {
		const next = replaceTypeBoundMetadata(
			{ archimate: { relationship: 'flow' }, owner: 'platform' },
			'archimate:flow',
			'composed-of',
			'composed-of',
		);
		const arch = next?.archimate as Record<string, unknown>;
		expect(arch.relationship).toBeUndefined();
		expect(arch['calm-core-variant']).toBe('composed-of');
		expect(next?.owner).toBe('platform');
	});

	it('stores persistable defaults and does not write type visualization', () => {
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
				},
				{
					typeId: 'difa-arch:impacts-replace',
					label: 'Impacts: Replace',
					calmCoreVariant: 'connects',
					'line-style': 'solid',
					'line-color': '#2563eb',
					defaults: {
						metadata: {
							'difa-arch': {
								relationship: 'impacts-replace',
								'calm-core-variant': 'connects',
							},
						},
					},
				},
			],
		});
		try {
			const next = replaceTypeBoundMetadata(
				{ 'line-style': 'solid', 'line-color': '#dc2626', owner: 'platform' },
				'difa-arch:impacts-new',
				'difa-arch:impacts-replace',
				'connects',
			);
			expect(next?.['line-style']).toBeUndefined();
			expect(next?.['line-color']).toBeUndefined();
			expect(next?.owner).toBe('platform');
			expect(next?.['difa-arch']).toEqual({
				relationship: 'impacts-replace',
				'calm-core-variant': 'connects',
			});
		} finally {
			unregisterPack('difa-arch');
		}
	});
});
