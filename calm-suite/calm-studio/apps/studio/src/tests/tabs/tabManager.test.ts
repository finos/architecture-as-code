// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, test } from 'vitest';
import type { Node } from '@xyflow/svelte';
import {
	MAX_DIAGRAM_TABS,
	closeTab,
	findTabByFile,
	openOrActivateTab,
	patchTabState,
	pickFifoEvictionCandidate,
	type DiagramTabState,
} from '$lib/tabs/tabManager';
import { createEmptyHistoryState } from '$lib/stores/history.svelte';

function makeTab(id: string, label: string, openedAt: number, relativePath: string | null = null): DiagramTabState {
	return {
		id,
		label,
		fileHandle: null,
		relativePath,
		openedAt,
		nodes: [] as Node[],
		edges: [],
		history: createEmptyHistoryState(),
		modelJson: '{"nodes":[],"relationships":[]}',
		cleanSnapshot: '{"nodes":[],"relationships":[]}',
		selectedNodeId: null,
		selectedEdgeId: null,
	};
}

describe('tabManager', () => {
	test('findTabByFile matches relative path', () => {
		const tabs = [makeTab('a', 'a.json', 1, 'arch/a.json')];
		expect(findTabByFile(tabs, 'arch/a.json', null)?.id).toBe('a');
	});

	test('openOrActivateTab activates existing tab without duplicate', () => {
		const tabs = [makeTab('a', 'a.json', 1, 'arch/a.json')];
		const result = openOrActivateTab(tabs, 'a', 'new-id', {
			label: 'a.json',
			relativePath: 'arch/a.json',
			nodes: [],
			edges: [],
			history: createEmptyHistoryState(),
			modelJson: '{}',
			cleanSnapshot: '{}',
		});
		expect(result.activatedExisting).toBe(true);
		expect(result.activeTabId).toBe('a');
		expect(result.tabs).toHaveLength(1);
	});

	test('openOrActivateTab evicts oldest tab when over MAX_DIAGRAM_TABS', () => {
		const tabs = Array.from({ length: MAX_DIAGRAM_TABS }, (_, i) =>
			makeTab(`t${i}`, `file-${i}.json`, i + 1, `f/${i}.json`)
		);
		const result = openOrActivateTab(tabs, 't0', 'new', {
			label: 'new.json',
			relativePath: 'f/new.json',
			nodes: [],
			edges: [],
			history: createEmptyHistoryState(),
			modelJson: '{}',
			cleanSnapshot: '{}',
		});
		expect(result.tabs).toHaveLength(MAX_DIAGRAM_TABS);
		expect(result.evicted?.id).toBe('t0');
		expect(result.activeTabId).toBe('new');
	});

	test('pickFifoEvictionCandidate returns oldest openedAt', () => {
		const tabs = [makeTab('a', 'a', 10), makeTab('b', 'b', 5), makeTab('c', 'c', 20)];
		expect(pickFifoEvictionCandidate(tabs)?.id).toBe('b');
	});

	test('closeTab selects neighbor when closing active tab', () => {
		const tabs = [makeTab('a', 'a', 1), makeTab('b', 'b', 2)];
		const result = closeTab(tabs, 'a', 'a');
		expect(result.tabs).toHaveLength(1);
		expect(result.activeTabId).toBe('b');
	});

	test('patchTabState updates only the targeted tab', () => {
		const tabs = [
			makeTab('a', 'a.json', 1, 'a.json'),
			makeTab('b', 'b.json', 2, 'b.json'),
		];
		const next = patchTabState(tabs, 'a', { modelJson: '{"nodes":[{"unique-id":"x"}],"relationships":[]}' });
		expect(next).toHaveLength(2);
		expect(next[0]?.modelJson).toContain('"x"');
		expect(next[1]?.modelJson).toBe(tabs[1]?.modelJson);
	});
});
