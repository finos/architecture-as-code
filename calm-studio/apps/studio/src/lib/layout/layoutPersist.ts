// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Hub / VS Code compatible canvas layout persistence (R48).
 * Architecture `metadata._layout`: unique-id → { x, y, w, h }.
 */

export interface LayoutEntry {
	x: number;
	y: number;
	w?: number;
	h?: number;
}

export type LayoutMap = Record<string, LayoutEntry>;

export type PositionMap = Map<string, { x: number; y: number; width?: number; height?: number }>;

export interface FlowNodeLike {
	id: string;
	position: { x: number; y: number };
	width?: number;
	height?: number;
	measured?: { width?: number; height?: number };
	data?: Record<string, unknown> | null;
}

function round(n: number): number {
	return Math.round(n);
}

export function isLayoutEntry(value: unknown): value is LayoutEntry {
	if (!value || typeof value !== 'object') return false;
	const v = value as Record<string, unknown>;
	return typeof v['x'] === 'number' && typeof v['y'] === 'number';
}

export function readLayoutMap(metadata: unknown): LayoutMap {
	if (!metadata || typeof metadata !== 'object') return {};
	const raw = (metadata as Record<string, unknown>)['_layout'];
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
	const out: LayoutMap = {};
	for (const [id, entry] of Object.entries(raw as Record<string, unknown>)) {
		if (!id || !isLayoutEntry(entry)) continue;
		out[id] = {
			x: entry.x,
			y: entry.y,
			...(typeof entry.w === 'number' ? { w: entry.w } : {}),
			...(typeof entry.h === 'number' ? { h: entry.h } : {}),
		};
	}
	return out;
}

export function layoutMapToPositionMap(map: LayoutMap): PositionMap {
	const positions: PositionMap = new Map();
	for (const [id, entry] of Object.entries(map)) {
		positions.set(id, {
			x: entry.x,
			y: entry.y,
			...(entry.w != null ? { width: entry.w } : {}),
			...(entry.h != null ? { height: entry.h } : {}),
		});
	}
	return positions;
}

export function flowNodesToLayoutMap(nodes: FlowNodeLike[]): LayoutMap {
	const map: LayoutMap = {};
	for (const n of nodes) {
		const id = (typeof n.data?.calmId === 'string' && n.data.calmId) || n.id;
		if (!id) continue;
		const w = n.measured?.width ?? n.width;
		const h = n.measured?.height ?? n.height;
		map[id] = {
			x: round(n.position.x),
			y: round(n.position.y),
			...(w != null ? { w: round(w) } : {}),
			...(h != null ? { h: round(h) } : {}),
		};
	}
	return map;
}

export function mergeLayoutIntoMetadata(
	metadata: Record<string, unknown> | undefined,
	layout: LayoutMap
): Record<string, unknown> {
	const next = { ...(metadata ?? {}) };
	if (Object.keys(layout).length === 0) {
		delete next['_layout'];
		return next;
	}
	next['_layout'] = layout;
	return next;
}

export function mergePositionMaps(base: PositionMap, overlay: PositionMap): PositionMap {
	const merged: PositionMap = new Map(base);
	for (const [id, pos] of overlay) merged.set(id, pos);
	return merged;
}

export interface LayoutJsonDoc {
	nodes?: Array<{ 'unique-id'?: string; metadata?: unknown }>;
	metadata?: unknown;
}

function nodeIds(doc: LayoutJsonDoc): string[] {
	return (doc.nodes ?? [])
		.map((n) => n['unique-id'])
		.filter((id): id is string => typeof id === 'string' && id.length > 0);
}

/**
 * When exactly one id is renamed and the applied layout does not already
 * contain both keys, move the layout entry to the new id (R80).
 */
export function rekeyLayoutMap(
	previousIds: string[],
	nextIds: string[],
	userLayout: LayoutMap,
	previousLayout: LayoutMap
): LayoutMap {
	const removed = previousIds.filter((id) => !nextIds.includes(id));
	const added = nextIds.filter((id) => !previousIds.includes(id));
	const next: LayoutMap = { ...userLayout };
	if (removed.length !== 1 || added.length !== 1) return next;
	const oldId = removed[0];
	const newId = added[0];
	if (oldId in next && newId in next) return next;
	if (newId in next) return next;
	const entry = next[oldId] ?? previousLayout[oldId];
	if (!entry) return next;
	next[newId] = entry;
	delete next[oldId];
	return next;
}

/**
 * JSON text is the source of truth for `metadata._layout` (R80).
 * A missing `_layout` key clears stored layout. Node metadata, including
 * `building-block-style`, is left on the applied document.
 */
export function prepareJsonLayout<T extends LayoutJsonDoc>(
	previous: LayoutJsonDoc,
	applied: T
): T {
	const meta = applied.metadata;
	const hasLayout =
		!!meta && typeof meta === 'object' && !Array.isArray(meta) && '_layout' in meta;
	if (!hasLayout) return applied;
	const metaRec = meta as Record<string, unknown>;
	const layout = rekeyLayoutMap(
		nodeIds(previous),
		nodeIds(applied),
		readLayoutMap(metaRec),
		readLayoutMap(previous.metadata)
	);
	return {
		...applied,
		metadata: {
			...metaRec,
			_layout: layout,
		},
	} as T;
}

export function jsonApplyHasLayout(doc: LayoutJsonDoc): boolean {
	const meta = doc.metadata;
	return !!meta && typeof meta === 'object' && !Array.isArray(meta) && '_layout' in meta;
}
