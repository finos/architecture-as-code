// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

export type Point = { x: number; y: number };
export type Rect = { left: number; top: number; width: number; height: number };
export type ViewBox = { x: number; y: number; width: number; height: number };

const CLICK_SLOP_PX = 4;

/** True when pointer-up is a click, not a minimap-mask drag. */
export function isMinimapClick(start: Point, end: Point, thresholdPx = CLICK_SLOP_PX): boolean {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	return dx * dx + dy * dy <= thresholdPx * thresholdPx;
}

/** Map a pointer on the mini-map SVG into diagram (world) coordinates. */
export function worldPointFromMinimapClick(
	client: Point,
	svgRect: Rect,
	viewBox: ViewBox
): Point | null {
	if (svgRect.width === 0 || svgRect.height === 0 || viewBox.width === 0 || viewBox.height === 0) {
		return null;
	}
	return {
		x: viewBox.x + ((client.x - svgRect.left) / svgRect.width) * viewBox.width,
		y: viewBox.y + ((client.y - svgRect.top) / svgRect.height) * viewBox.height,
	};
}

/**
 * Click (not drag) on the mini-map pans so `world` is centered.
 * Zoom must be passed through — XYFlow `setCenter` defaults to maxZoom.
 */
export function panViewportFromMinimapClick(options: {
	start: Point;
	end: Point;
	svgRect: Rect;
	viewBox: ViewBox;
	currentZoom: number;
	setCenter: (x: number, y: number, opts: { zoom: number }) => void;
}): boolean {
	if (!isMinimapClick(options.start, options.end)) return false;
	const world = worldPointFromMinimapClick(options.end, options.svgRect, options.viewBox);
	if (!world) return false;
	options.setCenter(world.x, world.y, { zoom: options.currentZoom });
	return true;
}
