// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Canvas pointer (R76). Empty-canvas drag pans. Drag on a node moves it.
 * Shift toggles selection. There is no Select/Pan mode and no Space-pan.
 */

export interface FlowPointerInteraction {
	panOnDrag: boolean | number[];
	selectionOnDrag: boolean;
	nodesDraggable: boolean;
}

export function canvasPointerInteraction(options: {
	shiftHeld: boolean;
	readonly: boolean;
}): FlowPointerInteraction {
	if (options.readonly) {
		return {
			panOnDrag: true,
			selectionOnDrag: false,
			nodesDraggable: false,
		};
	}
	if (options.shiftHeld) {
		return {
			panOnDrag: [1, 2],
			selectionOnDrag: false,
			nodesDraggable: true,
		};
	}
	return {
		panOnDrag: true,
		selectionOnDrag: false,
		nodesDraggable: true,
	};
}

/** Shift+click and Shift+marquee: add if absent, remove if present. */
export function toggleSelectionIds(selected: Iterable<string>, hits: Iterable<string>): Set<string> {
	const next = new Set(selected);
	for (const id of hits) {
		if (next.has(id)) next.delete(id);
		else next.add(id);
	}
	return next;
}

export interface FlowBox {
	id: string;
	position: { x: number; y: number };
	width?: number;
	height?: number;
	measured?: { width?: number; height?: number };
	parentId?: string;
}

export interface FlowRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

function absoluteOrigin(node: FlowBox, byId: Map<string, FlowBox>): { x: number; y: number } {
	let x = node.position.x;
	let y = node.position.y;
	let parentId = node.parentId;
	const seen = new Set<string>();
	while (parentId && !seen.has(parentId)) {
		seen.add(parentId);
		const parent = byId.get(parentId);
		if (!parent) break;
		x += parent.position.x;
		y += parent.position.y;
		parentId = parent.parentId;
	}
	return { x, y };
}

function rectsIntersect(a: FlowRect, b: FlowRect): boolean {
	return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** Node ids whose bounds intersect the flow-space rectangle. */
export function nodeIdsInRect(nodes: FlowBox[], rect: FlowRect): string[] {
	const byId = new Map(nodes.map((n) => [n.id, n]));
	const hits: string[] = [];
	for (const node of nodes) {
		const origin = absoluteOrigin(node, byId);
		const box: FlowRect = {
			x: origin.x,
			y: origin.y,
			width: node.measured?.width ?? node.width ?? 180,
			height: node.measured?.height ?? node.height ?? 70,
		};
		if (rectsIntersect(box, rect)) hits.push(node.id);
	}
	return hits;
}

export function isDiagramShortcutIgnored(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	const tag = target.tagName;
	if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
	if (target.isContentEditable) return true;
	if (target.closest('[role="dialog"]')) return true;
	if (target.closest('.cm-editor') || target.closest('.cm-content') || target.closest('.code-panel')) {
		return true;
	}
	return false;
}
