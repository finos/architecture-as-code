// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, test, expect, beforeEach } from 'vitest';
import type { Node, Edge } from '@xyflow/svelte';
import { pushSnapshot, undo, redo, canUndo, canRedo, resetHistory } from '$lib/stores/history.svelte';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeNode(id: string): Node {
	return {
		id,
		type: 'service',
		position: { x: 0, y: 0 },
		data: { label: id, calmId: `calm-${id}`, calmType: 'service' },
	};
}

const noEdges: Edge[] = [];

// ─── History tests ────────────────────────────────────────────────────────────

describe('history - undo/redo', () => {
	beforeEach(() => {
		resetHistory();
	});

	test('pushSnapshot adds snapshot to history stack — canUndo becomes true', () => {
		pushSnapshot([makeNode('n1')], noEdges);
		expect(canUndo()).toBe(true);
		expect(canRedo()).toBe(false);
	});

	test('undo returns the snapshot pushed before the edit', () => {
		const before = [makeNode('n1')];
		const after = [makeNode('n1'), makeNode('n2')];
		pushSnapshot(before, noEdges);
		const snapshot = undo({ nodes: after, edges: noEdges });
		expect(snapshot).not.toBeNull();
		expect(snapshot!.nodes).toHaveLength(1);
	});

	test('undo at start of history returns null', () => {
		// No snapshots pushed — undo should return null
		const snapshot = undo();
		expect(snapshot).toBeNull();
	});

	test('undo with one snapshot returns that snapshot', () => {
		pushSnapshot([makeNode('n1')], noEdges);
		const snapshot = undo();
		expect(snapshot).not.toBeNull();
		expect(snapshot!.nodes).toHaveLength(1);
		expect(undo()).toBeNull();
	});

	test('redo returns the canvas state passed to undo', () => {
		const before = [makeNode('n1')];
		const after = [makeNode('n1'), makeNode('n2')];
		pushSnapshot(before, noEdges);
		undo({ nodes: after, edges: noEdges });
		const redoSnapshot = redo();
		expect(redoSnapshot).not.toBeNull();
		expect(redoSnapshot!.nodes).toHaveLength(2);
	});

	test('redo at end of history returns null', () => {
		pushSnapshot([makeNode('n1')], noEdges);
		const snapshot = redo();
		expect(snapshot).toBeNull();
	});

	test('pushSnapshot after undo drops future history', () => {
		const before = [makeNode('n1')];
		const after = [makeNode('n1'), makeNode('n2')];
		const branch = [makeNode('n3')];
		pushSnapshot(before, noEdges);
		undo({ nodes: after, edges: noEdges });
		pushSnapshot(branch, noEdges);
		expect(canRedo()).toBe(false);
		expect(redo()).toBeNull();
	});
});

// ─── canUndo/canRedo state tests ──────────────────────────────────────────────

describe('history - canUndo/canRedo', () => {
	beforeEach(() => {
		resetHistory();
	});

	test('canUndo is false with no snapshots', () => {
		expect(canUndo()).toBe(false);
	});

	test('canRedo is false with no snapshots', () => {
		expect(canRedo()).toBe(false);
	});

	test('canUndo is true after one snapshot', () => {
		pushSnapshot([makeNode('n1')], noEdges);
		expect(canUndo()).toBe(true);
	});

	test('canRedo becomes true after undo of a live canvas', () => {
		pushSnapshot([makeNode('n1')], noEdges);
		undo({ nodes: [makeNode('n2')], edges: noEdges });
		expect(canRedo()).toBe(true);
	});

	test('snapshots are deep-cloned — mutations to original do not affect stored snapshot', () => {
		const nodes = [makeNode('n1')];
		pushSnapshot(nodes, noEdges);
		nodes[0].data.label = 'mutated';
		const snapshot = undo();
		expect(snapshot!.nodes[0].data.label).toBe('n1');
	});
});
