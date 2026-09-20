// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
	effectiveMouseMode,
	isSpacePanIgnored,
	svelteFlowInteraction,
} from '$lib/canvas/mousePanSelect';

describe('effectiveMouseMode', () => {
	it('defaults to the preferred Select mode', () => {
		expect(
			effectiveMouseMode({ preferred: 'select', spaceHeld: false, readonly: false })
		).toBe('select');
	});

	it('uses Pan when the user chose Pan', () => {
		expect(
			effectiveMouseMode({ preferred: 'pan', spaceHeld: false, readonly: false })
		).toBe('pan');
	});

	it('holds Space as temporary Pan and restores Select after', () => {
		expect(
			effectiveMouseMode({ preferred: 'select', spaceHeld: true, readonly: false })
		).toBe('pan');
		expect(
			effectiveMouseMode({ preferred: 'select', spaceHeld: false, readonly: false })
		).toBe('select');
	});

	it('locks Hub / read-only tabs to Pan', () => {
		expect(
			effectiveMouseMode({ preferred: 'select', spaceHeld: false, readonly: true })
		).toBe('pan');
	});
});

describe('svelteFlowInteraction', () => {
	it('marquees with the left button in Select and pans with middle/right', () => {
		expect(svelteFlowInteraction('select')).toEqual({
			panOnDrag: [1, 2],
			selectionOnDrag: true,
			nodesDraggable: true,
		});
	});

	it('pans with the left button in Pan and does not move nodes', () => {
		expect(svelteFlowInteraction('pan')).toEqual({
			panOnDrag: true,
			selectionOnDrag: false,
			nodesDraggable: false,
		});
	});
});

describe('isSpacePanIgnored', () => {
	it('ignores Space in inputs, dialogs, and the JSON editor', () => {
		const input = document.createElement('input');
		expect(isSpacePanIgnored(input)).toBe(true);
		const dialog = document.createElement('div');
		dialog.setAttribute('role', 'dialog');
		const inner = document.createElement('span');
		dialog.appendChild(inner);
		expect(isSpacePanIgnored(inner)).toBe(true);
		const cm = document.createElement('div');
		cm.className = 'cm-editor';
		const cmInner = document.createElement('div');
		cm.appendChild(cmInner);
		expect(isSpacePanIgnored(cmInner)).toBe(true);
	});

	it('uses Space to pan when focus is on the canvas', () => {
		const pane = document.createElement('div');
		pane.className = 'svelte-flow__pane';
		expect(isSpacePanIgnored(pane)).toBe(false);
	});
});
