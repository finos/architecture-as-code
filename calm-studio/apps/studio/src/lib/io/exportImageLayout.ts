// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Pure helpers for full-diagram SVG/PNG export layout.
 * Kept free of DOM / html-to-image so vitest can cover crop-prevention logic.
 */

export interface ExportBounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface ExportImageLayout {
	/** Output image width in CSS pixels */
	width: number;
	/** Output image height in CSS pixels */
	height: number;
	/** CSS transform applied to `.svelte-flow__viewport` during capture */
	transform: string;
	/** Zoom used in the transform */
	zoom: number;
	/** Translate x/y used in the transform */
	x: number;
	y: number;
}

export const EXPORT_MIN_DIMENSION = 400;
/** Cap to stay under typical browser canvas limits while still covering large diagrams. */
export const EXPORT_MAX_DIMENSION = 8192;
/** Fractional padding around node bounds (0.15 = 15% each side via getViewportForBounds). */
export const EXPORT_PADDING = 0.15;
/** Must be very low so large diagrams are never cropped by zoom clamp. */
export const EXPORT_MIN_ZOOM = 0.01;
export const EXPORT_MAX_ZOOM = 4;

/**
 * Compute axis-aligned bounds from flow nodes (world / absolute positions).
 * Nested nodes (`parentId`) accumulate parent offsets.
 */
export function computeNodesBounds(
	nodes: Array<{
		id: string;
		position: { x: number; y: number };
		width?: number;
		height?: number;
		measured?: { width?: number; height?: number };
		parentId?: string;
	}>
): ExportBounds {
	if (nodes.length === 0) {
		return { x: 0, y: 0, width: 0, height: 0 };
	}

	const byId = new Map(nodes.map((n) => [n.id, n]));

	function absolutePosition(node: (typeof nodes)[number]): { x: number; y: number } {
		let x = node.position.x;
		let y = node.position.y;
		let parentId = node.parentId;
		const seen = new Set<string>();
		while (parentId && !seen.has(parentId)) {
			seen.add(parentId);
			const parent = byId.get(parentId);
			if (!parent) break;
			x += parent.position.x;
			y += parent.position.y;
			parentId = parent.parentId;
		}
		return { x, y };
	}

	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;

	for (const node of nodes) {
		const { x, y } = absolutePosition(node);
		const w = node.measured?.width ?? node.width ?? 180;
		const h = node.measured?.height ?? node.height ?? 70;
		minX = Math.min(minX, x);
		minY = Math.min(minY, y);
		maxX = Math.max(maxX, x + w);
		maxY = Math.max(maxY, y + h);
	}

	return {
		x: minX,
		y: minY,
		width: Math.max(0, maxX - minX),
		height: Math.max(0, maxY - minY),
	};
}

/**
 * Viewport that fits `bounds` into a `width`×`height` canvas (xyflow algorithm).
 * Exposed for tests — mirrors `@xyflow` getViewportForBounds without the package mock.
 */
export function viewportForBounds(
	bounds: ExportBounds,
	width: number,
	height: number,
	minZoom: number,
	maxZoom: number,
	padding: number
): { x: number; y: number; zoom: number } {
	const padX = width * padding * 2;
	const padY = height * padding * 2;
	const bw = Math.max(bounds.width, 1);
	const bh = Math.max(bounds.height, 1);
	const xZoom = (width - padX) / bw;
	const yZoom = (height - padY) / bh;
	const zoom = Math.min(Math.max(Math.min(xZoom, yZoom), minZoom), maxZoom);
	const boundsCenterX = bounds.x + bounds.width / 2;
	const boundsCenterY = bounds.y + bounds.height / 2;
	return {
		x: width / 2 - boundsCenterX * zoom,
		y: height / 2 - boundsCenterY * zoom,
		zoom,
	};
}

/**
 * Choose export canvas size so the full diagram fits at ~1× zoom when possible,
 * then compute the viewport transform. Never clamps zoom so high that content is cropped.
 */
export function computeExportImageLayout(
	bounds: ExportBounds,
	options: {
		padding?: number;
		minZoom?: number;
		maxZoom?: number;
		minDimension?: number;
		maxDimension?: number;
	} = {}
): ExportImageLayout {
	const padding = options.padding ?? EXPORT_PADDING;
	const minZoom = options.minZoom ?? EXPORT_MIN_ZOOM;
	const maxZoom = options.maxZoom ?? EXPORT_MAX_ZOOM;
	const minDimension = options.minDimension ?? EXPORT_MIN_DIMENSION;
	const maxDimension = options.maxDimension ?? EXPORT_MAX_DIMENSION;

	const bw = Math.max(bounds.width, 1);
	const bh = Math.max(bounds.height, 1);
	// Size canvas so content + padding fits near zoom 1
	const padFactor = 1 + padding * 2;
	let width = Math.ceil(bw * padFactor);
	let height = Math.ceil(bh * padFactor);

	width = Math.max(minDimension, width);
	height = Math.max(minDimension, height);

	if (width > maxDimension || height > maxDimension) {
		const scale = Math.min(maxDimension / width, maxDimension / height);
		width = Math.max(minDimension, Math.floor(width * scale));
		height = Math.max(minDimension, Math.floor(height * scale));
	}

	const vp = viewportForBounds(bounds, width, height, minZoom, maxZoom, padding);

	// Safety: if zoom was clamped to minZoom and content still overflows, grow canvas
	const contentW = bw * vp.zoom * padFactor;
	const contentH = bh * vp.zoom * padFactor;
	if (contentW > width + 1 || contentH > height + 1) {
		width = Math.min(maxDimension, Math.max(width, Math.ceil(contentW)));
		height = Math.min(maxDimension, Math.max(height, Math.ceil(contentH)));
		const retry = viewportForBounds(bounds, width, height, minZoom, maxZoom, padding);
		return {
			width,
			height,
			x: retry.x,
			y: retry.y,
			zoom: retry.zoom,
			transform: `translate(${retry.x}px, ${retry.y}px) scale(${retry.zoom})`,
		};
	}

	return {
		width,
		height,
		x: vp.x,
		y: vp.y,
		zoom: vp.zoom,
		transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`,
	};
}

/**
 * Assert that after applying layout transform, bounds map inside the image rectangle.
 * Used by unit tests to prove full-diagram coverage (no crop).
 */
export function exportLayoutCoversBounds(
	layout: ExportImageLayout,
	bounds: ExportBounds,
	epsilon = 1
): boolean {
	const left = bounds.x * layout.zoom + layout.x;
	const top = bounds.y * layout.zoom + layout.y;
	const right = (bounds.x + bounds.width) * layout.zoom + layout.x;
	const bottom = (bounds.y + bounds.height) * layout.zoom + layout.y;
	return (
		left >= -epsilon &&
		top >= -epsilon &&
		right <= layout.width + epsilon &&
		bottom <= layout.height + epsilon
	);
}
