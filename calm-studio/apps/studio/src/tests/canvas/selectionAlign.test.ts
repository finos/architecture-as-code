// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { alignBoxes } from '$lib/canvas/selectionAlign';
import { packChildrenInSquareGrid, containerSizeForChildren } from '$lib/layout/containerGrid';

describe('selection align', () => {
	const boxes = [
		{ id: 'a', x: 10, y: 40, width: 80, height: 40 },
		{ id: 'b', x: 50, y: 10, width: 120, height: 60 },
	];

	it('aligns a row to the top edge', () => {
		const next = alignBoxes(boxes, 'top');
		expect(next[0]?.y).toBe(10);
		expect(next[1]?.y).toBe(10);
	});

	it('aligns a column to the left edge', () => {
		const next = alignBoxes(boxes, 'left');
		expect(next[0]?.x).toBe(10);
		expect(next[1]?.x).toBe(10);
	});

	it('makes width and height match the largest box', () => {
		const next = alignBoxes(boxes, 'same-size');
		expect(next[0]?.width).toBe(120);
		expect(next[0]?.height).toBe(60);
		expect(next[1]?.width).toBe(120);
	});
});

describe('arrange container table', () => {
	it('packs with explicit columns and resizes the container', () => {
		const positions = new Map(
			Array.from({ length: 6 }, (_, i) => [`n${i}`, { x: 0, y: 0, width: 100, height: 50 }])
		);
		const ids = Array.from({ length: 6 }, (_, i) => `n${i}`);
		const packed = packChildrenInSquareGrid(positions, ids, {
			cols: 3,
			gap: 10,
			padding: { top: 20, left: 10, bottom: 10, right: 10 },
		});
		expect(packed.get('n0')?.x).toBe(10);
		expect(packed.get('n3')?.y).toBeGreaterThan(packed.get('n0')?.y ?? 0);
		const size = containerSizeForChildren(packed, ids, {
			top: 20,
			left: 10,
			bottom: 10,
			right: 10,
		});
		expect(size.width).toBeGreaterThan(300);
		expect(size.height).toBeGreaterThan(100);
	});
});
