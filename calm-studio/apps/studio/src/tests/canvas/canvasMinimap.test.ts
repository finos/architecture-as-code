// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from 'vitest';
import {
	isMinimapClick,
	panViewportFromMinimapClick,
	worldPointFromMinimapClick,
} from '$lib/canvas/canvasMinimap';

const svgRect = { left: 0, top: 0, width: 200, height: 150 };
const viewBox = { x: 0, y: 0, width: 400, height: 300 };

describe('isMinimapClick', () => {
	it('treats a stationary pointer-up as a click', () => {
		expect(isMinimapClick({ x: 10, y: 10 }, { x: 10, y: 10 })).toBe(true);
		expect(isMinimapClick({ x: 10, y: 10 }, { x: 12, y: 11 })).toBe(true);
	});

	it('treats a moved pointer as a drag', () => {
		expect(isMinimapClick({ x: 10, y: 10 }, { x: 40, y: 10 })).toBe(false);
	});
});

describe('worldPointFromMinimapClick', () => {
	it('maps the mini-map origin to the viewBox origin', () => {
		expect(worldPointFromMinimapClick({ x: 0, y: 0 }, svgRect, viewBox)).toEqual({ x: 0, y: 0 });
	});

	it('maps a click to scaled world coordinates', () => {
		expect(worldPointFromMinimapClick({ x: 100, y: 75 }, svgRect, viewBox)).toEqual({
			x: 200,
			y: 150,
		});
	});

	it('returns null when the SVG has no size', () => {
		expect(
			worldPointFromMinimapClick({ x: 1, y: 1 }, { ...svgRect, width: 0 }, viewBox)
		).toBeNull();
	});
});

describe('panViewportFromMinimapClick', () => {
	it('centers the clicked world point and keeps zoom', () => {
		const setCenter = vi.fn();
		const ok = panViewportFromMinimapClick({
			start: { x: 50, y: 50 },
			end: { x: 50, y: 50 },
			svgRect,
			viewBox,
			currentZoom: 1.5,
			setCenter,
		});
		expect(ok).toBe(true);
		expect(setCenter).toHaveBeenCalledWith(100, 100, { zoom: 1.5 });
	});

	it('does not change zoom when the current zoom is not 1', () => {
		const setCenter = vi.fn();
		panViewportFromMinimapClick({
			start: { x: 0, y: 0 },
			end: { x: 0, y: 0 },
			svgRect,
			viewBox,
			currentZoom: 0.4,
			setCenter,
		});
		expect(setCenter.mock.calls[0]?.[2]).toEqual({ zoom: 0.4 });
	});

	it('ignores drags so the built-in mask pan can run', () => {
		const setCenter = vi.fn();
		expect(
			panViewportFromMinimapClick({
				start: { x: 10, y: 10 },
				end: { x: 80, y: 10 },
				svgRect,
				viewBox,
				currentZoom: 1,
				setCenter,
			})
		).toBe(false);
		expect(setCenter).not.toHaveBeenCalled();
	});
});
