// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, test, expect, beforeEach } from 'vitest';
import type { Node } from '@xyflow/svelte';
import { copy, paste, hasClipboard, resetClipboard } from '$lib/stores/clipboard.svelte';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeNode(id: string, selected = false, x = 0, y = 0): Node {
	return {
		id,
		type: 'service',
		position: { x, y },
		selected,
		data: { label: id, calmId: `calm-${id}`, calmType: 'service' },
	};
}

// ─── Clipboard tests ──────────────────────────────────────────────────────────

describe('clipboard - copy/paste', () => {
	beforeEach(() => {
		resetClipboard();
	});

	test('hasClipboard is false when nothing copied', () => {
		expect(hasClipboard()).toBe(false);
	});

	test('copy stores selected nodes — hasClipboard becomes true', () => {
		const nodes = [makeNode('n1', true), makeNode('n2', false)];
		copy(nodes);
		expect(hasClipboard()).toBe(true);
	});

	test('copy only stores selected nodes — unselected excluded', () => {
		const nodes = [makeNode('n1', true), makeNode('n2', false), makeNode('n3', true)];
		copy(nodes);
		const pasted = paste([]);
		expect(pasted).toHaveLength(2);
	});

	test('copy with no selected nodes — hasClipboard stays false', () => {
		const nodes = [makeNode('n1', false), makeNode('n2', false)];
		copy(nodes);
		expect(hasClipboard()).toBe(false);
	});

	test('paste returns cloned nodes with new IDs', () => {
		const original = makeNode('n1', true);
		copy([original]);
		const pasted = paste([]);
		expect(pasted[0].id).not.toBe('n1');
	});

	test('paste offsets position by +20,+20', () => {
		const original = makeNode('n1', true, 100, 200);
		copy([original]);
		const pasted = paste([]);
		expect(pasted[0].position.x).toBe(120);
		expect(pasted[0].position.y).toBe(220);
	});

	test('paste generates new calmId for each node', () => {
		const original = makeNode('n1', true);
		copy([original]);
		const pasted = paste([]);
		expect(pasted[0].data.calmId).not.toBe('calm-n1');
	});

	test('paste returns nodes with selected: false', () => {
		const original = makeNode('n1', true);
		copy([original]);
		const pasted = paste([]);
		expect(pasted[0].selected).toBe(false);
	});

	test('paste returns empty array when hasClipboard is false', () => {
		const pasted = paste([]);
		expect(pasted).toHaveLength(0);
	});

	test('pasted node IDs are unique across multiple pastes', () => {
		const original = makeNode('n1', true);
		copy([original]);
		const paste1 = paste([]);
		const paste2 = paste([...paste1]);
		expect(paste1[0].id).not.toBe(paste2[0].id);
	});
});
