// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
	canvasPointerInteraction,
	isDiagramShortcutIgnored,
	nodeIdsInRect,
	toggleSelectionIds,
} from '$lib/canvas/mousePanSelect';

describe('canvasPointerInteraction', () => {
	it('pans on empty drag and moves nodes when Shift is up', () => {
		expect(canvasPointerInteraction({ shiftHeld: false, readonly: false })).toEqual({
			panOnDrag: true,
			selectionOnDrag: false,
			nodesDraggable: true,
		});
	});

	it('keeps middle and right pan while Shift is held so the left button can marquee', () => {
		expect(canvasPointerInteraction({ shiftHeld: true, readonly: false })).toEqual({
			panOnDrag: [1, 2],
			selectionOnDrag: false,
			nodesDraggable: true,
		});
	});

	it('locks a read-only tab to pan without moving nodes', () => {
		expect(canvasPointerInteraction({ shiftHeld: true, readonly: true })).toEqual({
			panOnDrag: true,
			selectionOnDrag: false,
			nodesDraggable: false,
		});
	});
});

describe('toggleSelectionIds', () => {
	it('adds a missing id and removes an id that is already selected', () => {
		expect([...toggleSelectionIds(['a', 'b'], ['b', 'c'])].sort()).toEqual(['a', 'c']);
	});
});

describe('nodeIdsInRect', () => {
	it('returns nodes whose bounds intersect the rectangle', () => {
		const hits = nodeIdsInRect(
			[
				{ id: 'in', position: { x: 10, y: 10 }, width: 40, height: 20 },
				{ id: 'out', position: { x: 200, y: 200 }, width: 40, height: 20 },
			],
			{ x: 0, y: 0, width: 80, height: 80 }
		);
		expect(hits).toEqual(['in']);
	});
});

describe('isDiagramShortcutIgnored', () => {
	it('ignores shortcuts in inputs and the JSON editor', () => {
		const input = document.createElement('input');
		expect(isDiagramShortcutIgnored(input)).toBe(true);
		const cm = document.createElement('div');
		cm.className = 'cm-editor';
		const inner = document.createElement('div');
		cm.appendChild(inner);
		expect(isDiagramShortcutIgnored(inner)).toBe(true);
	});

	it('does not ignore the canvas pane', () => {
		const pane = document.createElement('div');
		pane.className = 'svelte-flow__pane';
		expect(isDiagramShortcutIgnored(pane)).toBe(false);
	});
});
