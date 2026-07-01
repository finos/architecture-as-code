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
		pushSnapshot([makeNode('n1'), makeNode('n2')], noEdges);
		expect(canUndo()).toBe(true);
		expect(canRedo()).toBe(false);
	});

	test('undo returns previous snapshot', () => {
		const nodes1 = [makeNode('n1')];
		const nodes2 = [makeNode('n1'), makeNode('n2')];
		pushSnapshot(nodes1, noEdges);
		pushSnapshot(nodes2, noEdges);
		const snapshot = undo();
		expect(snapshot).not.toBeNull();
		expect(snapshot!.nodes).toHaveLength(1);
	});

	test('undo at start of history returns null', () => {
		// No snapshots pushed — undo should return null
		const snapshot = undo();
		expect(snapshot).toBeNull();
	});

	test('undo with only one snapshot returns null (at start)', () => {
		pushSnapshot([makeNode('n1')], noEdges);
		// pointer is at 0 — no previous to go to
		const snapshot = undo();
		expect(snapshot).toBeNull();
	});

	test('redo returns next snapshot after undo', () => {
		const nodes1 = [makeNode('n1')];
		const nodes2 = [makeNode('n1'), makeNode('n2')];
		pushSnapshot(nodes1, noEdges);
		pushSnapshot(nodes2, noEdges);
		undo();
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
		const nodes1 = [makeNode('n1')];
		const nodes2 = [makeNode('n1'), makeNode('n2')];
		const nodes3 = [makeNode('n3')];
		pushSnapshot(nodes1, noEdges);
		pushSnapshot(nodes2, noEdges);
		undo(); // go back to nodes1
		pushSnapshot(nodes3, noEdges); // branch off — drops nodes2
		expect(canRedo()).toBe(false);
		const snapshot = redo();
		expect(snapshot).toBeNull();
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

	test('canUndo is false with one snapshot (at start)', () => {
		pushSnapshot([makeNode('n1')], noEdges);
		expect(canUndo()).toBe(false);
	});

	test('canUndo is true with two or more snapshots', () => {
		pushSnapshot([makeNode('n1')], noEdges);
		pushSnapshot([makeNode('n2')], noEdges);
		expect(canUndo()).toBe(true);
	});

	test('canRedo becomes true after undo', () => {
		pushSnapshot([makeNode('n1')], noEdges);
		pushSnapshot([makeNode('n2')], noEdges);
		undo();
		expect(canRedo()).toBe(true);
	});

	test('snapshots are deep-cloned — mutations to original do not affect stored snapshot', () => {
		const nodes = [makeNode('n1')];
		pushSnapshot(nodes, noEdges);
		pushSnapshot([makeNode('n2')], noEdges);
		// Mutate original node after pushing
		nodes[0].data.label = 'mutated';
		const snapshot = undo();
		expect(snapshot!.nodes[0].data.label).toBe('n1');
	});
});
