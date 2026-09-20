// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Pack container children into a near-square row/column table (R46).
 */

export type SizedPosition = { x: number; y: number; width?: number; height?: number };

export interface SquareGridOptions {
	gap?: number;
	padding?: { top: number; left: number; bottom: number; right: number };
	defaultWidth?: number;
	defaultHeight?: number;
	/** Explicit column count (R67). */
	cols?: number;
	/** Explicit row count — used when `cols` is omitted. */
	rows?: number;
}

export function squareGridDimensions(
	count: number,
	explicit?: { cols?: number; rows?: number }
): { cols: number; rows: number } {
	if (count <= 0) return { cols: 0, rows: 0 };
	if (explicit?.cols && explicit.cols > 0) {
		const cols = explicit.cols;
		return { cols, rows: Math.ceil(count / cols) };
	}
	if (explicit?.rows && explicit.rows > 0) {
		const rows = explicit.rows;
		return { cols: Math.ceil(count / rows), rows };
	}
	const cols = Math.ceil(Math.sqrt(count));
	const rows = Math.ceil(count / cols);
	return { cols, rows };
}

export function packChildrenInSquareGrid(
	positions: Map<string, SizedPosition>,
	childIds: string[],
	options: SquareGridOptions = {}
): Map<string, SizedPosition> {
	const result = new Map(positions);
	if (childIds.length === 0) return result;

	const gap = options.gap ?? 80;
	const pad = options.padding ?? { top: 56, left: 40, bottom: 40, right: 40 };
	const defaultWidth = options.defaultWidth ?? 180;
	const defaultHeight = options.defaultHeight ?? 70;
	const { cols } = squareGridDimensions(childIds.length, {
		cols: options.cols,
		rows: options.rows,
	});

	const sizes = childIds.map((id) => {
		const p = result.get(id);
		return {
			id,
			width: p?.width ?? defaultWidth,
			height: p?.height ?? defaultHeight,
		};
	});

	const colWidths: number[] = Array.from({ length: cols }, () => 0);
	const rowHeights: number[] = [];
	for (let i = 0; i < sizes.length; i++) {
		const col = i % cols;
		const row = Math.floor(i / cols);
		colWidths[col] = Math.max(colWidths[col] ?? 0, sizes[i]!.width);
		rowHeights[row] = Math.max(rowHeights[row] ?? 0, sizes[i]!.height);
	}

	const colX: number[] = [];
	let x = pad.left;
	for (let c = 0; c < cols; c++) {
		colX[c] = x;
		x += (colWidths[c] ?? defaultWidth) + gap;
	}
	const rowY: number[] = [];
	let y = pad.top;
	for (let r = 0; r < rowHeights.length; r++) {
		rowY[r] = y;
		y += (rowHeights[r] ?? defaultHeight) + gap;
	}

	for (let i = 0; i < sizes.length; i++) {
		const col = i % cols;
		const row = Math.floor(i / cols);
		const prev = result.get(sizes[i]!.id);
		result.set(sizes[i]!.id, {
			x: colX[col] ?? pad.left,
			y: rowY[row] ?? pad.top,
			width: prev?.width ?? sizes[i]!.width,
			height: prev?.height ?? sizes[i]!.height,
		});
	}

	return result;
}

export function containerSizeForChildren(
	positions: Map<string, SizedPosition>,
	ids: string[],
	padding: { top: number; left: number; bottom: number; right: number },
	fallbackW = 180,
	fallbackH = 70
): { width: number; height: number } {
	let maxX = padding.left;
	let maxY = padding.top;
	for (const id of ids) {
		const p = positions.get(id);
		if (!p) continue;
		const w = p.width ?? fallbackW;
		const h = p.height ?? fallbackH;
		maxX = Math.max(maxX, p.x + w);
		maxY = Math.max(maxY, p.y + h);
	}
	return { width: maxX + padding.right, height: maxY + padding.bottom };
}

export function boundingBoxAspectRatio(
	positions: Map<string, SizedPosition>,
	ids: string[],
	fallbackW = 180,
	fallbackH = 70
): number {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const id of ids) {
		const p = positions.get(id);
		if (!p) continue;
		const w = p.width ?? fallbackW;
		const h = p.height ?? fallbackH;
		minX = Math.min(minX, p.x);
		minY = Math.min(minY, p.y);
		maxX = Math.max(maxX, p.x + w);
		maxY = Math.max(maxY, p.y + h);
	}
	const width = maxX - minX;
	const height = maxY - minY;
	if (width <= 0 || height <= 0) return 1;
	return width / height;
}
