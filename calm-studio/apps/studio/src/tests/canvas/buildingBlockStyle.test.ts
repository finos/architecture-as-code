// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
	getNodeStyleOverride,
	writeNodeStyleOverride,
} from '$lib/canvas/buildingBlockStyle';

describe('buildingBlockStyle', () => {
	it('reads building-block-style', () => {
		expect(
			getNodeStyleOverride({
				'building-block-style': { background: '#a9e22c', text: '#6a2216' },
			})
		).toEqual({ background: '#a9e22c', text: '#6a2216' });
	});

	it('reads fidelity-style alias when building-block-style is absent', () => {
		expect(getNodeStyleOverride({ 'fidelity-style': { background: '#fff' } })).toEqual({
			background: '#fff',
		});
	});

	it('omits the object when both colors are unset', () => {
		const next = writeNodeStyleOverride(
			{ owner: 'x', 'building-block-style': { background: '#000' } },
			{}
		);
		expect(next['building-block-style']).toBeUndefined();
		expect(next.owner).toBe('x');
	});
});
