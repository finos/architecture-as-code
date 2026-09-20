// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
	boundingBoxAspectRatio,
	packChildrenInSquareGrid,
	squareGridDimensions,
} from '$lib/layout/containerGrid';

describe('containerGrid', () => {
	it('packs 9 children into a 3×3 table', () => {
		expect(squareGridDimensions(9)).toEqual({ cols: 3, rows: 3 });
		const positions = new Map(
			Array.from({ length: 9 }, (_, i) => [`n${i}`, { x: 0, y: 0, width: 100, height: 80 }])
		);
		const packed = packChildrenInSquareGrid(positions, Array.from({ length: 9 }, (_, i) => `n${i}`), {
			gap: 10,
			padding: { top: 0, left: 0, bottom: 0, right: 0 },
		});
		const aspect = boundingBoxAspectRatio(packed, Array.from({ length: 9 }, (_, i) => `n${i}`));
		expect(aspect).toBeGreaterThan(0.5);
		expect(aspect).toBeLessThan(2);
		expect(packed.get('n0')?.x).toBe(0);
		expect(packed.get('n1')?.x).toBeGreaterThan(0);
		expect(packed.get('n3')?.y).toBeGreaterThan(0);
	});

	it('uses more than one column for 4 children', () => {
		expect(squareGridDimensions(4)).toEqual({ cols: 2, rows: 2 });
	});

	it('allows a short last row for 10 children', () => {
		expect(squareGridDimensions(10)).toEqual({ cols: 4, rows: 3 });
	});
});
