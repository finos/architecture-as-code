// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Session diagram filter / fog match sets (R29).
 */

import type { Node, Edge } from '@xyflow/svelte';
import { readMetadataPath, getMetadataFieldsForNodeType } from '$lib/metadata/metadataForm';

export type DiagramFilterMode = 'off' | 'focus-neighbors' | 'metadata' | 'node-type';

export interface DiagramFilterState {
	mode: DiagramFilterMode;
	/** Dot path joined, e.g. `owner` or `archimate.layer` */
	metadataKey?: string;
	metadataValue?: string;
	/** Selected node-type values when mode is `node-type`. */
	nodeTypes?: string[];
}

export const DEFAULT_DIAGRAM_FILTER: DiagramFilterState = { mode: 'off' };

export interface FogMatchSet {
	nodeIds: Set<string>;
	edgeIds: Set<string>;
}

function nodeCalmId(n: Node): string {
	return (n.data?.calmId as string | undefined) ?? n.id;
}

function edgeEndpoints(e: Edge): { source: string; target: string } {
	return { source: e.source, target: e.target };
}

/** Direct 1-hop neighbors of focus on the current diagram (inbound + outbound). */
export function computeFocusNeighborMatch(
	nodes: Node[],
	edges: Edge[],
	focusUniqueId: string | null
): FogMatchSet {
	const nodeIds = new Set<string>();
	const edgeIds = new Set<string>();
	if (!focusUniqueId) return { nodeIds, edgeIds };

	nodeIds.add(focusUniqueId);
	for (const e of edges) {
		const { source, target } = edgeEndpoints(e);
		if (source === focusUniqueId || target === focusUniqueId) {
			edgeIds.add(e.id);
			nodeIds.add(source);
			nodeIds.add(target);
		}
	}
	// Also resolve calmId aliases on nodes
	for (const n of nodes) {
		const id = nodeCalmId(n);
		if (nodeIds.has(n.id) || nodeIds.has(id)) {
			nodeIds.add(n.id);
			nodeIds.add(id);
		}
	}
	return { nodeIds, edgeIds };
}

function getNestedValue(obj: unknown, path: string[]): unknown {
	let cur: unknown = obj;
	for (const p of path) {
		if (!cur || typeof cur !== 'object') return undefined;
		cur = (cur as Record<string, unknown>)[p];
	}
	return cur;
}

/** Metadata keys available for filter: schema fields ∪ keys present on diagram. */
export function collectMetadataFilterKeys(nodes: Node[]): Array<{ key: string; path: string[]; label: string }> {
	const byKey = new Map<string, { key: string; path: string[]; label: string }>();

	for (const n of nodes) {
		const calmType = (n.data?.calmType as string) ?? '';
		const fields = getMetadataFieldsForNodeType(calmType);
		if (fields) {
			for (const f of fields) {
				const key = f.path.join('.');
				if (!byKey.has(key)) {
					byKey.set(key, { key, path: f.path, label: f.label });
				}
			}
		}
		const meta = n.data?.metadata as Record<string, unknown> | undefined;
		if (meta && typeof meta === 'object') {
			collectFlatKeys(meta, [], byKey);
		}
	}

	return [...byKey.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function collectFlatKeys(
	obj: Record<string, unknown>,
	prefix: string[],
	into: Map<string, { key: string; path: string[]; label: string }>
): void {
	for (const [k, v] of Object.entries(obj)) {
		const path = [...prefix, k];
		if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
			collectFlatKeys(v as Record<string, unknown>, path, into);
		} else {
			const key = path.join('.');
			if (!into.has(key)) {
				into.set(key, { key, path, label: key });
			}
		}
	}
}

/** Distinct string values for a metadata path present on the diagram. */
export function collectMetadataValuesOnDiagram(nodes: Node[], path: string[]): string[] {
	const values = new Set<string>();
	for (const n of nodes) {
		const meta = n.data?.metadata;
		const raw =
			meta && typeof meta === 'object'
				? getNestedValue(meta, path) ?? readMetadataPath(meta as Record<string, unknown>, path)
				: undefined;
		if (raw === undefined || raw === null) continue;
		const s = String(raw);
		if (s.length > 0) values.add(s);
	}
	return [...values].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export function computeMetadataMatch(
	nodes: Node[],
	edges: Edge[],
	path: string[],
	value: string
): FogMatchSet {
	const nodeIds = new Set<string>();
	for (const n of nodes) {
		const meta = n.data?.metadata;
		const raw =
			meta && typeof meta === 'object'
				? getNestedValue(meta, path) ?? readMetadataPath(meta as Record<string, unknown>, path)
				: undefined;
		if (raw !== undefined && raw !== null && String(raw) === value) {
			nodeIds.add(n.id);
			nodeIds.add(nodeCalmId(n));
		}
	}

	const edgeIds = new Set<string>();
	for (const e of edges) {
		if (nodeIds.has(e.source) && nodeIds.has(e.target)) {
			edgeIds.add(e.id);
		}
	}
	return { nodeIds, edgeIds };
}

function nodeTypeOf(n: Node): string {
	return String(n.data?.calmType ?? '');
}

/** Distinct node-type values present on the current diagram. */
export function collectNodeTypesOnDiagram(nodes: Node[]): string[] {
	const types = new Set<string>();
	for (const n of nodes) {
		const t = nodeTypeOf(n);
		if (t) types.add(t);
	}
	return [...types].sort((a, b) => a.localeCompare(b));
}

export function computeNodeTypeMatch(
	nodes: Node[],
	edges: Edge[],
	selectedTypes: string[]
): FogMatchSet {
	const typeSet = new Set(selectedTypes);
	const nodeIds = new Set<string>();
	for (const n of nodes) {
		if (typeSet.has(nodeTypeOf(n))) {
			nodeIds.add(n.id);
			nodeIds.add(nodeCalmId(n));
		}
	}
	const edgeIds = new Set<string>();
	for (const e of edges) {
		if (nodeIds.has(e.source) && nodeIds.has(e.target)) {
			edgeIds.add(e.id);
		}
	}
	return { nodeIds, edgeIds };
}

export function computeFogMatchSet(
	filter: DiagramFilterState,
	nodes: Node[],
	edges: Edge[],
	focusUniqueId: string | null
): FogMatchSet | null {
	if (filter.mode === 'off') return null;
	if (filter.mode === 'focus-neighbors') {
		return computeFocusNeighborMatch(nodes, edges, focusUniqueId);
	}
	if (filter.mode === 'metadata' && filter.metadataKey && filter.metadataValue) {
		const path = filter.metadataKey.split('.');
		return computeMetadataMatch(nodes, edges, path, filter.metadataValue);
	}
	if (filter.mode === 'node-type' && (filter.nodeTypes?.length ?? 0) > 0) {
		return computeNodeTypeMatch(nodes, edges, filter.nodeTypes ?? []);
	}
	return null;
}

const FOG_CLASS = 'diagram-fogged';

function classToString(cls: Node['class'] | Edge['class']): string {
	if (!cls) return '';
	if (typeof cls === 'string') return cls;
	if (Array.isArray(cls)) {
		return cls
			.flatMap((c) => (typeof c === 'string' ? [c] : []))
			.join(' ');
	}
	if (typeof cls === 'object') {
		return Object.entries(cls)
			.filter(([, on]) => Boolean(on))
			.map(([k]) => k)
			.join(' ');
	}
	return '';
}

function stripFogClass(cls: Node['class'] | Edge['class']): string {
	return classToString(cls)
		.split(/\s+/)
		.filter((c) => c && c !== FOG_CLASS)
		.join(' ');
}

/** Apply or clear fog classes on nodes and edges (session visual only).
 * Returns the same object references when fog state is unchanged (avoids render loops).
 */
export function applyFogClasses(
	nodes: Node[],
	edges: Edge[],
	match: FogMatchSet | null
): { nodes: Node[]; edges: Edge[] } {
	let nodesChanged = false;
	let edgesChanged = false;

	const nextNodes = nodes.map((n) => {
		const id = nodeCalmId(n);
		const matched = match ? match.nodeIds.has(n.id) || match.nodeIds.has(id) : true;
		const base = stripFogClass(n.class);
		const nextClass = matched ? base : `${base} ${FOG_CLASS}`.trim();
		const current = classToString(n.class);
		if (nextClass === current) return n;
		nodesChanged = true;
		return { ...n, class: nextClass || undefined };
	});

	const nextEdges = edges.map((e) => {
		const matched = match ? match.edgeIds.has(e.id) : true;
		const base = stripFogClass(e.class);
		const nextClass = matched ? base : `${base} ${FOG_CLASS}`.trim();
		const current = classToString(e.class);
		if (nextClass === current) return e;
		edgesChanged = true;
		return { ...e, class: nextClass || undefined };
	});

	return {
		nodes: nodesChanged ? nextNodes : nodes,
		edges: edgesChanged ? nextEdges : edges,
	};
}
