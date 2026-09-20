// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { packChildrenInSquareGrid, type SizedPosition } from '$lib/layout/containerGrid';

export interface AlignBox {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
}

export type AlignMode =
	| 'left'
	| 'right'
	| 'center-x'
	| 'top'
	| 'bottom'
	| 'center-y'
	| 'distribute-x'
	| 'distribute-y'
	| 'same-width'
	| 'same-height'
	| 'same-size'
	| 'table';

function sizeOf(box: AlignBox): { width: number; height: number } {
	return { width: box.width || 180, height: box.height || 70 };
}

export function alignBoxes(boxes: AlignBox[], mode: AlignMode): AlignBox[] {
	if (boxes.length < 2 && mode !== 'table') return boxes;
	if (boxes.length === 0) return boxes;

	const next = boxes.map((b) => ({ ...b }));
	const minX = Math.min(...next.map((b) => b.x));
	const minY = Math.min(...next.map((b) => b.y));
	const maxX = Math.max(...next.map((b) => b.x + sizeOf(b).width));
	const maxY = Math.max(...next.map((b) => b.y + sizeOf(b).height));

	if (mode === 'left') {
		for (const b of next) b.x = minX;
	} else if (mode === 'right') {
		for (const b of next) b.x = maxX - sizeOf(b).width;
	} else if (mode === 'center-x') {
		const cx = (minX + maxX) / 2;
		for (const b of next) b.x = cx - sizeOf(b).width / 2;
	} else if (mode === 'top') {
		for (const b of next) b.y = minY;
	} else if (mode === 'bottom') {
		for (const b of next) b.y = maxY - sizeOf(b).height;
	} else if (mode === 'center-y') {
		const cy = (minY + maxY) / 2;
		for (const b of next) b.y = cy - sizeOf(b).height / 2;
	} else if (mode === 'distribute-x') {
		const ordered = [...next].sort((a, b) => a.x - b.x);
		const first = ordered[0]!;
		const last = ordered[ordered.length - 1]!;
		const span = last.x - first.x;
		const step = ordered.length > 1 ? span / (ordered.length - 1) : 0;
		ordered.forEach((b, i) => {
			b.x = first.x + step * i;
		});
	} else if (mode === 'distribute-y') {
		const ordered = [...next].sort((a, b) => a.y - b.y);
		const first = ordered[0]!;
		const last = ordered[ordered.length - 1]!;
		const span = last.y - first.y;
		const step = ordered.length > 1 ? span / (ordered.length - 1) : 0;
		ordered.forEach((b, i) => {
			b.y = first.y + step * i;
		});
	} else if (mode === 'same-width' || mode === 'same-height' || mode === 'same-size') {
		const maxW = Math.max(...next.map((b) => sizeOf(b).width));
		const maxH = Math.max(...next.map((b) => sizeOf(b).height));
		for (const b of next) {
			if (mode !== 'same-height') b.width = maxW;
			if (mode !== 'same-width') b.height = maxH;
		}
	} else if (mode === 'table') {
		const positions = new Map<string, SizedPosition>();
		for (const b of next) {
			positions.set(b.id, { x: b.x, y: b.y, width: sizeOf(b).width, height: sizeOf(b).height });
		}
		const packed = packChildrenInSquareGrid(
			positions,
			next.map((b) => b.id),
			{ gap: 40, padding: { top: 0, left: 0, bottom: 0, right: 0 } }
		);
		for (const b of next) {
			const p = packed.get(b.id);
			if (!p) continue;
			b.x = minX + p.x;
			b.y = minY + p.y;
		}
	}

	return next;
}
