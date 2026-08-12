// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Bulk tab close set computation (R31) — VS Code–style left / right / all.
 */

import type { DiagramTabState } from '$lib/tabs/tabManager';

export type BulkCloseMode = 'left' | 'right' | 'all';

/**
 * Tabs to close relative to the clicked tab (by current tab-bar order).
 * Close all includes the clicked / current tab.
 */
export function tabsToClose(
	tabs: DiagramTabState[],
	clickedTabId: string,
	mode: BulkCloseMode
): DiagramTabState[] {
	const index = tabs.findIndex((t) => t.id === clickedTabId);
	if (index === -1) return [];

	switch (mode) {
		case 'left':
			return tabs.slice(0, index);
		case 'right':
			return tabs.slice(index + 1);
		case 'all':
			return [...tabs];
	}
}
