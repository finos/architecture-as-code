// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Dragging the edge between two columns changes only those columns (R94).
 * The sum of widths stays the same. A column cannot shrink to zero.
 */

export function resizeAdjacentColumns(
	widths: number[],
	edgeIndex: number,
	delta: number,
	min = 48
): number[] {
	const right = edgeIndex + 1;
	if (edgeIndex < 0 || right >= widths.length) return widths.slice();
	const next = widths.slice();
	const leftWidth = next[edgeIndex] ?? 0;
	const rightWidth = next[right] ?? 0;
	let applied = delta;
	if (applied > 0) applied = Math.min(applied, rightWidth - min);
	else applied = Math.max(applied, min - leftWidth);
	if (applied === 0) return next;
	next[edgeIndex] = leftWidth + applied;
	next[right] = rightWidth - applied;
	return next;
}
