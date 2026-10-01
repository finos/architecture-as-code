// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
	flowNodesToLayoutMap,
	layoutMapToPositionMap,
	mergeLayoutIntoMetadata,
	prepareJsonLayout,
	readLayoutMap,
} from '$lib/layout/layoutPersist';

describe('layoutPersist', () => {
	it('writes integer x,y,w,h keyed by unique-id', () => {
		const map = flowNodesToLayoutMap([
			{
				id: 'flow-1',
				position: { x: 12.4, y: -3.6 },
				width: 100.2,
				height: 50.8,
				data: { calmId: 'svc-1' },
			},
		]);
		expect(map['svc-1']).toEqual({ x: 12, y: -4, w: 100, h: 51 });
	});

	it('reads _layout and ignores extra / invalid keys', () => {
		const map = readLayoutMap({
			_layout: {
				a: { x: 1, y: 2, w: 3, h: 4 },
				bad: { x: 'no' },
			},
		});
		expect(map).toEqual({ a: { x: 1, y: 2, w: 3, h: 4 } });
		expect(layoutMapToPositionMap(map).get('a')).toEqual({
			x: 1,
			y: 2,
			width: 3,
			height: 4,
		});
	});

	it('omits _layout when the map is empty', () => {
		expect(mergeLayoutIntoMetadata({ owner: 'x', _layout: { a: { x: 1, y: 1 } } }, {})).toEqual({
			owner: 'x',
		});
	});

	it('keeps layout and node colors when the JSON edit does not touch them', () => {
		const previous = {
			metadata: { _layout: { a: { x: 10, y: 20, w: 80, h: 40 } } },
			nodes: [
				{
					'unique-id': 'a',
					metadata: { 'building-block-style': { background: '#a9e22c', text: '#111' } },
				},
			],
		};
		const applied = {
			metadata: { _layout: { a: { x: 10, y: 20, w: 80, h: 40 } } },
			nodes: [
				{
					'unique-id': 'a',
					name: 'Renamed',
					metadata: { 'building-block-style': { background: '#a9e22c', text: '#111' } },
				},
			],
		};
		expect(prepareJsonLayout(previous, applied)).toEqual(applied);
	});

	it('leaves a deleted _layout key deleted', () => {
		const previous = {
			metadata: { _layout: { a: { x: 1, y: 2 } } },
			nodes: [{ 'unique-id': 'a' }],
		};
		const applied = { metadata: { owner: 'x' }, nodes: [{ 'unique-id': 'a' }] };
		expect(prepareJsonLayout(previous, applied).metadata).toEqual({ owner: 'x' });
	});

	it('re-keys layout when unique-id changes and the layout entry was not edited', () => {
		const previous = {
			metadata: { _layout: { a: { x: 4, y: 5 } } },
			nodes: [{ 'unique-id': 'a' }],
		};
		const applied = {
			metadata: { _layout: { a: { x: 4, y: 5 } } },
			nodes: [{ 'unique-id': 'b' }],
		};
		expect(prepareJsonLayout(previous, applied).metadata?._layout).toEqual({
			b: { x: 4, y: 5 },
		});
	});
});
