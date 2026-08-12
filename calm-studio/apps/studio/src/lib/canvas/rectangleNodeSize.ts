// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/** Layout constants for horizontal (rectangle) node chrome — keep in sync with node Svelte CSS. */
const H_PADDING = 20; // 8px + 10px horizontal padding
/** Default inline icon width for core service/system rectangle nodes. */
const ICON_WIDTH = 14;
/** ArchiMate inline icons: 2× the 10px node label font. */
export const ARCHIMATE_ICON_WIDTH = 20;
const ITEM_GAP = 7;
const GLASSES_WIDTH = 24; // inline reference icon + margin
const CLASSIFICATION_WIDTH = 48;
const CHAR_WIDTH = 6.5; // ~10px semibold label
const MIN_WIDTH = 90;
const MIN_HEIGHT = 50;

export interface RectangleNodeSizeOptions {
	hasReference?: boolean;
	hasClassification?: boolean;
	/** Override inline icon width (e.g. ArchiMate uses {@link ARCHIMATE_ICON_WIDTH}). */
	iconWidth?: number;
}

/**
 * Estimates Svelte Flow width/height for rectangle-layout nodes so the label
 * fits without truncation. Used when creating or projecting box-style nodes.
 */
export function estimateRectangleNodeSize(
	label: string,
	options: RectangleNodeSizeOptions = {},
): { width: number; height: number } {
	const text = label.trim() || 'Node';
	const iconWidth = options.iconWidth ?? ICON_WIDTH;
	let width = H_PADDING + iconWidth + ITEM_GAP + text.length * CHAR_WIDTH;
	if (options.hasReference) {
		width += ITEM_GAP + GLASSES_WIDTH;
	}
	if (options.hasClassification) {
		width += ITEM_GAP + CLASSIFICATION_WIDTH;
	}
	return {
		width: Math.ceil(Math.max(MIN_WIDTH, width)),
		height: MIN_HEIGHT,
	};
}

/**
 * Picks node width: grows to fit label but preserves user-enlarged sizes.
 */
export function resolveRectangleNodeWidth(
	storedWidth: number | undefined,
	label: string,
	options: RectangleNodeSizeOptions = {},
): number {
	const estimated = estimateRectangleNodeSize(label, options);
	if (storedWidth === undefined) {
		return estimated.width;
	}
	return Math.max(storedWidth, estimated.width);
}
