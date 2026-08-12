// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * obstacleRouter.ts — Orthogonal edge routing that avoids node bounding boxes (R23 / #16).
 *
 * Pure TypeScript — no .svelte.ts imports (vitest-friendly).
 */

export type HandlePosition = 'top' | 'bottom' | 'left' | 'right';

export interface ObstacleRect {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface RouteEdgeInput {
	source: { x: number; y: number; position: HandlePosition };
	target: { x: number; y: number; position: HandlePosition };
	obstacles: ObstacleRect[];
	/** Padding around obstacles. Default 8. */
	padding?: number;
}

export interface RouteEdgeResult {
	path: string;
	labelX: number;
	labelY: number;
	intersectionCount: number;
}

interface Point {
	x: number;
	y: number;
}

const DEFAULT_PADDING = 8;

function inflate(rect: ObstacleRect, padding: number): ObstacleRect {
	return {
		id: rect.id,
		x: rect.x - padding,
		y: rect.y - padding,
		width: rect.width + padding * 2,
		height: rect.height + padding * 2,
	};
}

/** True if open segment (a→b) intersects the interior of an axis-aligned rect. */
export function segmentIntersectsRect(a: Point, b: Point, rect: ObstacleRect): boolean {
	const minX = rect.x;
	const maxX = rect.x + rect.width;
	const minY = rect.y;
	const maxY = rect.y + rect.height;

	// Both endpoints outside on the same side → no interior hit for axis-aligned segment
	if (a.x === b.x) {
		const x = a.x;
		if (x <= minX || x >= maxX) return false;
		const y0 = Math.min(a.y, b.y);
		const y1 = Math.max(a.y, b.y);
		return y0 < maxY && y1 > minY;
	}
	if (a.y === b.y) {
		const y = a.y;
		if (y <= minY || y >= maxY) return false;
		const x0 = Math.min(a.x, b.x);
		const x1 = Math.max(a.x, b.x);
		return x0 < maxX && x1 > minX;
	}

	// Non-orthogonal (shouldn't happen) — sample midpoint
	const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
	return pointInRectInterior(mid, rect);
}

export function pointInRectInterior(p: Point, rect: ObstacleRect): boolean {
	return (
		p.x > rect.x &&
		p.x < rect.x + rect.width &&
		p.y > rect.y &&
		p.y < rect.y + rect.height
	);
}

function pathIntersectionCount(points: Point[], obstacles: ObstacleRect[]): number {
	let count = 0;
	for (let i = 0; i < points.length - 1; i++) {
		for (const obs of obstacles) {
			if (segmentIntersectsRect(points[i], points[i + 1], obs)) count += 1;
		}
	}
	return count;
}

function pointsToSvgPath(points: Point[]): string {
	if (points.length === 0) return '';
	let d = `M ${points[0].x},${points[0].y}`;
	for (let i = 1; i < points.length; i++) {
		d += ` L ${points[i].x},${points[i].y}`;
	}
	return d;
}

function labelAtMid(points: Point[]): Point {
	if (points.length < 2) return points[0] ?? { x: 0, y: 0 };
	let total = 0;
	const segs: number[] = [];
	for (let i = 0; i < points.length - 1; i++) {
		const len = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
		segs.push(len);
		total += len;
	}
	let remaining = total / 2;
	for (let i = 0; i < segs.length; i++) {
		if (remaining <= segs[i]) {
			const t = segs[i] === 0 ? 0 : remaining / segs[i];
			return {
				x: points[i].x + (points[i + 1].x - points[i].x) * t,
				y: points[i].y + (points[i + 1].y - points[i].y) * t,
			};
		}
		remaining -= segs[i];
	}
	return points[points.length - 1];
}

/** Classic orthogonal smooth-step style path (no obstacle awareness). */
function smoothStepPoints(
	sx: number,
	sy: number,
	tx: number,
	ty: number,
	sourcePos: HandlePosition,
	targetPos: HandlePosition
): Point[] {
	const midX = (sx + tx) / 2;
	const midY = (sy + ty) / 2;

	const horizontalSource = sourcePos === 'left' || sourcePos === 'right';
	const horizontalTarget = targetPos === 'left' || targetPos === 'right';

	if (horizontalSource && horizontalTarget) {
		return [
			{ x: sx, y: sy },
			{ x: midX, y: sy },
			{ x: midX, y: ty },
			{ x: tx, y: ty },
		];
	}
	if (!horizontalSource && !horizontalTarget) {
		return [
			{ x: sx, y: sy },
			{ x: sx, y: midY },
			{ x: tx, y: midY },
			{ x: tx, y: ty },
		];
	}
	if (horizontalSource) {
		return [
			{ x: sx, y: sy },
			{ x: tx, y: sy },
			{ x: tx, y: ty },
		];
	}
	return [
		{ x: sx, y: sy },
		{ x: sx, y: ty },
		{ x: tx, y: ty },
	];
}

function aroundObstaclePoints(
	sx: number,
	sy: number,
	tx: number,
	ty: number,
	obstacles: ObstacleRect[],
	side: 'above' | 'below' | 'left' | 'right'
): Point[] {
	if (obstacles.length === 0) {
		return smoothStepPoints(sx, sy, tx, ty, 'right', 'left');
	}
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const o of obstacles) {
		minX = Math.min(minX, o.x);
		minY = Math.min(minY, o.y);
		maxX = Math.max(maxX, o.x + o.width);
		maxY = Math.max(maxY, o.y + o.height);
	}
	const pad = 12;
	let wx: number;
	let wy: number;
	switch (side) {
		case 'above':
			wx = (sx + tx) / 2;
			wy = minY - pad;
			break;
		case 'below':
			wx = (sx + tx) / 2;
			wy = maxY + pad;
			break;
		case 'left':
			wx = minX - pad;
			wy = (sy + ty) / 2;
			break;
		case 'right':
			wx = maxX + pad;
			wy = (sy + ty) / 2;
			break;
	}
	return [
		{ x: sx, y: sy },
		{ x: sx, y: wy },
		{ x: wx, y: wy },
		{ x: tx, y: wy },
		{ x: tx, y: ty },
	];
}

/**
 * Route an orthogonal edge that avoids obstacle interiors when possible.
 */
export function routeEdgeOrthogonal(input: RouteEdgeInput): RouteEdgeResult {
	const padding = input.padding ?? DEFAULT_PADDING;
	const inflated = input.obstacles.map((o) => inflate(o, padding));
	const { x: sx, y: sy, position: sp } = input.source;
	const { x: tx, y: ty, position: tp } = input.target;

	const candidates: Point[][] = [
		smoothStepPoints(sx, sy, tx, ty, sp, tp),
		aroundObstaclePoints(sx, sy, tx, ty, inflated, 'above'),
		aroundObstaclePoints(sx, sy, tx, ty, inflated, 'below'),
		aroundObstaclePoints(sx, sy, tx, ty, inflated, 'left'),
		aroundObstaclePoints(sx, sy, tx, ty, inflated, 'right'),
	];

	let best = candidates[0];
	let bestCount = pathIntersectionCount(best, inflated);

	for (let i = 1; i < candidates.length; i++) {
		const count = pathIntersectionCount(candidates[i], inflated);
		if (count < bestCount) {
			best = candidates[i];
			bestCount = count;
			if (bestCount === 0) break;
		}
	}

	const label = labelAtMid(best);
	return {
		path: pointsToSvgPath(best),
		labelX: label.x,
		labelY: label.y,
		intersectionCount: bestCount,
	};
}

/** Collect world-space obstacle rects from flow nodes, excluding given ids. */
export function collectNodeObstacles(
	nodes: Array<{
		id: string;
		position: { x: number; y: number };
		width?: number;
		height?: number;
		measured?: { width?: number; height?: number };
		parentId?: string;
	}>,
	excludeIds: Set<string>,
	padding = 0
): ObstacleRect[] {
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

	const obstacles: ObstacleRect[] = [];
	for (const node of nodes) {
		if (excludeIds.has(node.id)) continue;
		const w = node.measured?.width ?? node.width ?? 180;
		const h = node.measured?.height ?? node.height ?? 70;
		const pos = absolutePosition(node);
		obstacles.push(
			inflate(
				{
					id: node.id,
					x: pos.x,
					y: pos.y,
					width: w,
					height: h,
				},
				padding
			)
		);
	}
	return obstacles;
}

/**
 * Push overlapping sibling boxes apart until none intersect (including gap).
 * Returns a new map; does not mutate the input.
 */
export function resolveSiblingOverlaps(
	positions: Map<string, { x: number; y: number; width?: number; height?: number }>,
	siblings: string[],
	gap = 24
): Map<string, { x: number; y: number; width?: number; height?: number }> {
	const result = new Map(positions);
	const ids = siblings.filter((id) => result.has(id));
	if (ids.length < 2) return result;

	const maxPasses = Math.max(40, ids.length * ids.length);
	for (let pass = 0; pass < maxPasses; pass++) {
		let moved = false;
		// Sort by position each pass for more stable separation
		ids.sort((aId, bId) => {
			const a = result.get(aId)!;
			const b = result.get(bId)!;
			return a.y - b.y || a.x - b.x;
		});

		for (let i = 0; i < ids.length; i++) {
			for (let j = i + 1; j < ids.length; j++) {
				const a = result.get(ids[i])!;
				const b = result.get(ids[j])!;
				const aw = a.width ?? 180;
				const ah = a.height ?? 70;
				const bw = b.width ?? 180;
				const bh = b.height ?? 70;
				// Inflate by gap/2 each side so required clear spacing is `gap`
				const pad = gap / 2;
				const ax1 = a.x - pad;
				const ay1 = a.y - pad;
				const ax2 = a.x + aw + pad;
				const ay2 = a.y + ah + pad;
				const bx1 = b.x - pad;
				const by1 = b.y - pad;
				const bx2 = b.x + bw + pad;
				const by2 = b.y + bh + pad;
				const overlapX = Math.min(ax2, bx2) - Math.max(ax1, bx1);
				const overlapY = Math.min(ay2, by2) - Math.max(ay1, by1);
				if (overlapX > 0 && overlapY > 0) {
					if (overlapX <= overlapY) {
						const shift = overlapX / 2 + 0.5;
						if (a.x + aw / 2 <= b.x + bw / 2) {
							result.set(ids[i], { ...a, x: a.x - shift });
							result.set(ids[j], { ...b, x: b.x + shift });
						} else {
							result.set(ids[i], { ...a, x: a.x + shift });
							result.set(ids[j], { ...b, x: b.x - shift });
						}
					} else {
						const shift = overlapY / 2 + 0.5;
						if (a.y + ah / 2 <= b.y + bh / 2) {
							result.set(ids[i], { ...a, y: a.y - shift });
							result.set(ids[j], { ...b, y: b.y + shift });
						} else {
							result.set(ids[i], { ...a, y: a.y + shift });
							result.set(ids[j], { ...b, y: b.y - shift });
						}
					}
					moved = true;
				}
			}
		}
		if (!moved) break;
	}

	// Normalize so the group stays in non-negative local coords (important for nested children)
	let minX = Infinity;
	let minY = Infinity;
	for (const id of ids) {
		const p = result.get(id)!;
		minX = Math.min(minX, p.x);
		minY = Math.min(minY, p.y);
	}
	if (Number.isFinite(minX) && Number.isFinite(minY) && (minX < 0 || minY < 0)) {
		const dx = minX < 0 ? -minX : 0;
		const dy = minY < 0 ? -minY : 0;
		for (const id of ids) {
			const p = result.get(id)!;
			result.set(id, { ...p, x: p.x + dx, y: p.y + dy });
		}
	}

	return result;
}

/** True if any pair of siblings still overlaps (including gap). */
export function siblingsHaveOverlap(
	positions: Map<string, { x: number; y: number; width?: number; height?: number }>,
	siblings: string[],
	gap = 24
): boolean {
	const ids = siblings.filter((id) => positions.has(id));
	const pad = gap / 2;
	for (let i = 0; i < ids.length; i++) {
		for (let j = i + 1; j < ids.length; j++) {
			const a = positions.get(ids[i])!;
			const b = positions.get(ids[j])!;
			const aw = a.width ?? 180;
			const ah = a.height ?? 70;
			const bw = b.width ?? 180;
			const bh = b.height ?? 70;
			const overlapX =
				Math.min(a.x + aw + pad, b.x + bw + pad) - Math.max(a.x - pad, b.x - pad);
			const overlapY =
				Math.min(a.y + ah + pad, b.y + bh + pad) - Math.max(a.y - pad, b.y - pad);
			if (overlapX > 0 && overlapY > 0) return true;
		}
	}
	return false;
}
