// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, test } from 'vitest';
import type { Node } from '@xyflow/svelte';
import { tabsToClose } from '$lib/tabs/bulkClose';
import type { DiagramTabState } from '$lib/tabs/tabManager';
import { createEmptyHistoryState } from '$lib/stores/history.svelte';

function makeTab(id: string, label: string): DiagramTabState {
	return {
		id,
		label,
		fileHandle: null,
		relativePath: null,
		openedAt: 0,
		nodes: [] as Node[],
		edges: [],
		history: createEmptyHistoryState(),
		modelJson: '{}',
		cleanSnapshot: '{}',
		selectedNodeId: null,
		selectedEdgeId: null,
	};
}

describe('bulkClose', () => {
	const tabs = [makeTab('a', 'a.json'), makeTab('b', 'b.json'), makeTab('c', 'c.json')];

	test('close left of middle tab', () => {
		expect(tabsToClose(tabs, 'b', 'left').map((t) => t.id)).toEqual(['a']);
	});

	test('close right of middle tab', () => {
		expect(tabsToClose(tabs, 'b', 'right').map((t) => t.id)).toEqual(['c']);
	});

	test('close all includes current', () => {
		expect(tabsToClose(tabs, 'b', 'all').map((t) => t.id)).toEqual(['a', 'b', 'c']);
	});

	test('unknown tab returns empty', () => {
		expect(tabsToClose(tabs, 'missing', 'all')).toEqual([]);
	});
});
