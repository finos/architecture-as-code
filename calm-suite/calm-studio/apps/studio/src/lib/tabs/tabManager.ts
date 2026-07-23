// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import type { Node, Edge } from '@xyflow/svelte';
import type { HistoryState } from '$lib/stores/history.svelte';

/** Maximum open diagram tabs (FIFO eviction when exceeded). */
export const MAX_DIAGRAM_TABS = 10;

export interface DiagramTabState {
	id: string;
	label: string;
	fileHandle: FileSystemFileHandle | string | null;
	relativePath: string | null;
	openedAt: number;
	nodes: Node[];
	edges: Edge[];
	history: HistoryState;
	modelJson: string;
	cleanSnapshot: string;
	selectedNodeId: string | null;
	selectedEdgeId: string | null;
}

export interface OpenTabRequest {
	label: string;
	fileHandle?: FileSystemFileHandle | string | null;
	relativePath?: string | null;
	nodes: Node[];
	edges: Edge[];
	history: HistoryState;
	modelJson: string;
	cleanSnapshot: string;
	selectedNodeId?: string | null;
	selectedEdgeId?: string | null;
}

export interface TabManagerResult {
	tabs: DiagramTabState[];
	activeTabId: string;
	/** Tab removed by FIFO eviction, if any. */
	evicted?: DiagramTabState;
	/** True when an existing tab was activated instead of creating a new one. */
	activatedExisting?: boolean;
}

/** Match tab to a file by relative path or handle identity. */
export function tabMatchesFile(
	tab: DiagramTabState,
	relativePath: string | null,
	fileHandle: FileSystemFileHandle | string | null
): boolean {
	if (relativePath && tab.relativePath === relativePath) return true;
	if (fileHandle == null) return false;
	if (tab.fileHandle === fileHandle) return true;
	if (typeof fileHandle === 'string' && typeof tab.fileHandle === 'string') {
		return fileHandle === tab.fileHandle;
	}
	return false;
}

export function findTabByFile(
	tabs: DiagramTabState[],
	relativePath: string | null,
	fileHandle: FileSystemFileHandle | string | null
): DiagramTabState | undefined {
	return tabs.find((t) => tabMatchesFile(t, relativePath, fileHandle));
}

/** Oldest tab by openedAt — candidate for FIFO eviction. */
export function pickFifoEvictionCandidate(tabs: DiagramTabState[]): DiagramTabState | null {
	if (tabs.length === 0) return null;
	return tabs.reduce((oldest, tab) => (tab.openedAt < oldest.openedAt ? tab : oldest));
}

export function formatTabLabel(tab: DiagramTabState, isDirty: boolean): string {
	const base = tab.label || 'Untitled';
	return isDirty ? `${base} •` : base;
}

/**
 * Open a file in a new tab or activate an existing tab for the same file.
 * When at capacity, evicts the oldest tab (FIFO).
 */
export function openOrActivateTab(
	tabs: DiagramTabState[],
	activeTabId: string | null,
	tabId: string,
	request: OpenTabRequest,
	now = Date.now()
): TabManagerResult {
	const existing = findTabByFile(
		tabs,
		request.relativePath ?? null,
		request.fileHandle ?? null
	);
	if (existing) {
		return {
			tabs,
			activeTabId: existing.id,
			activatedExisting: true,
		};
	}

	const newTab: DiagramTabState = {
		id: tabId,
		label: request.label,
		fileHandle: request.fileHandle ?? null,
		relativePath: request.relativePath ?? null,
		openedAt: now,
		nodes: structuredClone(request.nodes),
		edges: structuredClone(request.edges),
		history: structuredClone(request.history),
		modelJson: request.modelJson,
		cleanSnapshot: request.cleanSnapshot,
		selectedNodeId: request.selectedNodeId ?? null,
		selectedEdgeId: request.selectedEdgeId ?? null,
	};

	let nextTabs = [...tabs, newTab];
	let evicted: DiagramTabState | undefined;

	if (nextTabs.length > MAX_DIAGRAM_TABS) {
		const victim = pickFifoEvictionCandidate(nextTabs.filter((t) => t.id !== tabId));
		if (victim) {
			nextTabs = nextTabs.filter((t) => t.id !== victim.id);
			evicted = victim;
		}
	}

	return { tabs: nextTabs, activeTabId: tabId, evicted };
}

export function closeTab(
	tabs: DiagramTabState[],
	activeTabId: string | null,
	tabId: string
): { tabs: DiagramTabState[]; activeTabId: string | null } {
	const index = tabs.findIndex((t) => t.id === tabId);
	if (index === -1) return { tabs, activeTabId };

	const nextTabs = tabs.filter((t) => t.id !== tabId);
	if (nextTabs.length === 0) {
		return { tabs: [], activeTabId: null };
	}

	if (activeTabId !== tabId) {
		return { tabs: nextTabs, activeTabId };
	}

	const nextIndex = Math.min(index, nextTabs.length - 1);
	return { tabs: nextTabs, activeTabId: nextTabs[nextIndex]!.id };
}

export function activateTab(_tabs: DiagramTabState[], tabId: string): string {
	return tabId;
}

/** Update in-memory state for the active tab before switching away. */
export function patchTabState(
	tabs: DiagramTabState[],
	tabId: string,
	patch: Partial<
		Pick<
			DiagramTabState,
			| 'nodes'
			| 'edges'
			| 'history'
			| 'modelJson'
			| 'cleanSnapshot'
			| 'selectedNodeId'
			| 'selectedEdgeId'
			| 'label'
			| 'fileHandle'
			| 'relativePath'
		>
	>
): DiagramTabState[] {
	return tabs.map((t) => (t.id === tabId ? { ...t, ...patch } : t));
}
