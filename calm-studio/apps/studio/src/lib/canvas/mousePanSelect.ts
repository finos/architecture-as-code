// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

export type MouseCanvasMode = 'select' | 'pan';

export function effectiveMouseMode(options: {
	preferred: MouseCanvasMode;
	spaceHeld: boolean;
	readonly: boolean;
}): MouseCanvasMode {
	if (options.readonly || options.spaceHeld) return 'pan';
	return options.preferred;
}

export function svelteFlowInteraction(mode: MouseCanvasMode): {
	panOnDrag: boolean | number[];
	selectionOnDrag: boolean;
	nodesDraggable: boolean;
} {
	if (mode === 'pan') {
		return {
			panOnDrag: true,
			selectionOnDrag: false,
			nodesDraggable: false,
		};
	}
	return {
		panOnDrag: [1, 2],
		selectionOnDrag: true,
		nodesDraggable: true,
	};
}

export function isSpacePanIgnored(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	const tag = target.tagName;
	if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
	if (target.isContentEditable) return true;
	if (tag === 'BUTTON' || target.closest('button')) return true;
	if (target.closest('[role="dialog"]')) return true;
	if (target.closest('.cm-editor') || target.closest('.cm-content') || target.closest('.code-panel')) {
		return true;
	}
	return false;
}
