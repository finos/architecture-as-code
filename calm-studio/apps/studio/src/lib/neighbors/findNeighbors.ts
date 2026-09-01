// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Find project-wide 1-hop neighbors of a node (R28).
 * Scans CALM JSON files under configured project roots (or whole project).
 */

import type { CalmArchitecture, CalmNode, CalmRelationship } from '@calmstudio/calm-core';
import {
	getConnectsEndpoints,
	getReferencedNodeIds,
	getRelationshipVariant,
} from '@calmstudio/calm-core';
import { scanDirectoryTree } from '$lib/explorer/folderScan';
import type { ExplorerTreeEntry } from '$lib/explorer/types';

export type NeighborDirection = 'in' | 'out' | 'related';

export interface NeighborHit {
	rowId: string;
	neighborUniqueId: string;
	neighborName: string;
	neighborNodeType: string;
	neighborDescription: string;
	relationshipUniqueId: string;
	relationshipType: string;
	direction: NeighborDirection;
	/** File that owns the relationship (for copy). */
	sourceRelativePath: string;
	/** Preferred home file of the neighbor node (for detailed-architecture). */
	neighborHomePath: string;
	relationship: CalmRelationship;
	neighborNode: CalmNode;
}

export interface NeighborFilters {
	nodeTypes?: Set<string>;
	relationshipTypes?: Set<string>;
}

export interface ScanNeighborsOptions {
	/** Project-relative folder roots (incl. subfolders). Empty = whole project. */
	searchRoots?: string[];
	/**
	 * Live architecture of the open diagram. Merged over the on-disk file so
	 * outbound (source) relationships in the active editor are never missed.
	 */
	activeArchitecture?: CalmArchitecture | null;
}

interface IndexedNode {
	node: CalmNode;
	relativePath: string;
}

interface IndexedFile {
	relativePath: string;
	arch: CalmArchitecture;
}

export function listJsonFiles(entries: ExplorerTreeEntry[]): Array<{ relativePath: string; handle: FileSystemFileHandle }> {
	const out: Array<{ relativePath: string; handle: FileSystemFileHandle }> = [];
	for (const entry of entries) {
		if (entry.kind === 'file') {
			out.push({ relativePath: entry.relativePath, handle: entry.handle });
		} else {
			out.push(...listJsonFiles(entry.children));
		}
	}
	return out;
}

function normalizeProjectPath(path: string): string {
	return path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

/** True when `relativePath` is under one of the search roots (or roots are empty). */
export function isPathUnderSearchRoots(relativePath: string, searchRoots: string[]): boolean {
	const roots = searchRoots.map(normalizeProjectPath).filter(Boolean);
	if (roots.length === 0) return true;
	const path = normalizeProjectPath(relativePath);
	return roots.some((root) => path === root || path.startsWith(`${root}/`));
}

function parseArchitecture(text: string): CalmArchitecture | null {
	try {
		const parsed = JSON.parse(text) as Partial<CalmArchitecture>;
		if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.relationships)) return null;
		return parsed as CalmArchitecture;
	} catch {
		return null;
	}
}

/**
 * Direction relative to focus:
 * - connects: source→out, destination→in
 * - interacts: actor→out (focus is actor), nodes→in (focus is in nodes)
 * - composed-of / deployed-in: container→out, child→in
 */
export function directionFor(
	rel: CalmRelationship,
	focusId: string,
	neighborId: string
): NeighborDirection {
	const connects = getConnectsEndpoints(rel);
	if (connects) {
		if (connects.source === focusId && connects.destination === neighborId) return 'out';
		if (connects.destination === focusId && connects.source === neighborId) return 'in';
	}

	const rt = rel['relationship-type'];
	if (rt.interacts) {
		if (rt.interacts.actor === focusId && rt.interacts.nodes?.includes(neighborId)) return 'out';
		if (rt.interacts.actor === neighborId && rt.interacts.nodes?.includes(focusId)) return 'in';
	}
	if (rt['composed-of']) {
		const co = rt['composed-of'];
		if (co.container === focusId && co.nodes?.includes(neighborId)) return 'out';
		if (co.container === neighborId && co.nodes?.includes(focusId)) return 'in';
	}
	if (rt['deployed-in']) {
		const d = rt['deployed-in'];
		if (d.container === focusId && d.nodes?.includes(neighborId)) return 'out';
		if (d.container === neighborId && d.nodes?.includes(focusId)) return 'in';
	}
	return 'related';
}

function placeholderNode(uniqueId: string): CalmNode {
	return {
		'unique-id': uniqueId,
		'node-type': 'system',
		name: uniqueId,
		description: '',
	};
}

/** Collect 1-hop neighbor rows using a project-wide node index for lookups. */
export function collectNeighborsFromArchitecture(
	arch: CalmArchitecture,
	focusUniqueId: string,
	sourceRelativePath: string,
	nodeIndex?: Map<string, IndexedNode>
): NeighborHit[] {
	const localById = new Map(arch.nodes.map((n) => [n['unique-id'], n]));
	const hits: NeighborHit[] = [];

	for (const rel of arch.relationships) {
		const ids = getReferencedNodeIds(rel);
		if (!ids.includes(focusUniqueId)) continue;

		const variant = getRelationshipVariant(rel['relationship-type']);
		for (const neighborId of ids) {
			if (neighborId === focusUniqueId) continue;

			const indexed = nodeIndex?.get(neighborId);
			const neighborNode =
				indexed?.node ??
				localById.get(neighborId) ??
				placeholderNode(neighborId);

			const neighborHomePath = indexed?.relativePath ?? sourceRelativePath;

			hits.push({
				rowId: `${sourceRelativePath}::${rel['unique-id']}::${neighborId}`,
				neighborUniqueId: neighborId,
				neighborName: neighborNode.name || neighborId,
				neighborNodeType: neighborNode['node-type'] || 'system',
				neighborDescription: neighborNode.description ?? '',
				relationshipUniqueId: rel['unique-id'],
				relationshipType: variant,
				direction: directionFor(rel, focusUniqueId, neighborId),
				sourceRelativePath,
				neighborHomePath,
				relationship: JSON.parse(JSON.stringify(rel)) as CalmRelationship,
				neighborNode: JSON.parse(JSON.stringify(neighborNode)) as CalmNode,
			});
		}
	}

	return hits;
}

/**
 * One row per distinct relationship+neighbor (keeps every source/outbound edge visible).
 * True duplicates (same rel id + neighbor from overlapping files) are collapsed.
 */
export function dedupeNeighborHits(hits: NeighborHit[]): NeighborHit[] {
	const byKey = new Map<string, NeighborHit>();
	for (const hit of hits) {
		const key = `${hit.relationshipUniqueId}::${hit.neighborUniqueId}`;
		if (byKey.has(key)) continue;
		byKey.set(key, hit);
	}
	return [...byKey.values()].sort((a, b) => {
		const byName = a.neighborName.localeCompare(b.neighborName, undefined, {
			sensitivity: 'base',
		});
		if (byName !== 0) return byName;
		return a.relationshipUniqueId.localeCompare(b.relationshipUniqueId);
	});
}

/** Expand selected rows back to relationship hits (identity when already per-relationship). */
export function expandHitsForNeighborIds(
	allHits: NeighborHit[],
	neighborUniqueIds: Iterable<string>
): NeighborHit[] {
	const wanted = new Set(neighborUniqueIds);
	const seenRel = new Set<string>();
	const out: NeighborHit[] = [];
	for (const hit of allHits) {
		if (!wanted.has(hit.neighborUniqueId)) continue;
		const key = `${hit.relationshipUniqueId}::${hit.neighborUniqueId}`;
		if (seenRel.has(key)) continue;
		seenRel.add(key);
		out.push(hit);
	}
	return out;
}

/** Expand by selected row ids (preferred — preserves specific relationships). */
export function expandHitsForRowIds(allHits: NeighborHit[], rowIds: Iterable<string>): NeighborHit[] {
	const wanted = new Set(rowIds);
	return allHits.filter((h) => wanted.has(h.rowId));
}

export function filterNeighborHits(
	hits: NeighborHit[],
	filters: NeighborFilters
): NeighborHit[] {
	return hits.filter((h) => {
		if (filters.nodeTypes && filters.nodeTypes.size > 0 && !filters.nodeTypes.has(h.neighborNodeType)) {
			return false;
		}
		if (
			filters.relationshipTypes &&
			filters.relationshipTypes.size > 0 &&
			!filters.relationshipTypes.has(h.relationshipType)
		) {
			return false;
		}
		return true;
	});
}

function indexNodesFromArchitecture(
	nodeIndex: Map<string, IndexedNode>,
	arch: CalmArchitecture,
	relativePath: string
): void {
	for (const node of arch.nodes) {
		const id = node['unique-id'];
		if (!id) continue;
		// Prefer a non-reference definition as the home when available
		const existing = nodeIndex.get(id);
		const isRef =
			typeof node.details?.['detailed-architecture'] === 'string' &&
			(node.details['detailed-architecture'] as string).length > 0;
		if (!existing || (existing.node.details?.['detailed-architecture'] && !isRef)) {
			nodeIndex.set(id, { node, relativePath });
		}
	}
}

/**
 * Scan project for neighbors of `focusUniqueId`.
 * Always includes the active diagram (even outside search roots) and optional
 * in-memory architecture so outbound (source) relationships are listed.
 * Uses a project-wide node index so relationships can reference nodes defined elsewhere.
 */
export async function scanProjectNeighbors(
	root: FileSystemDirectoryHandle,
	focusUniqueId: string,
	activeRelativePath: string | null,
	options: ScanNeighborsOptions = {}
): Promise<NeighborHit[]> {
	const searchRoots = options.searchRoots ?? [];
	const activePath = activeRelativePath ? normalizeProjectPath(activeRelativePath) : null;
	const tree = await scanDirectoryTree(root);
	const files = listJsonFiles(tree).filter((f) => {
		const path = normalizeProjectPath(f.relativePath);
		if (activePath && path === activePath) return true;
		return isPathUnderSearchRoots(f.relativePath, searchRoots);
	});

	const indexedFiles: IndexedFile[] = [];
	const nodeIndex = new Map<string, IndexedNode>();

	for (const file of files) {
		try {
			const text = await (await file.handle.getFile()).text();
			const arch = parseArchitecture(text);
			if (!arch) continue;
			indexedFiles.push({ relativePath: file.relativePath, arch });
			indexNodesFromArchitecture(nodeIndex, arch, file.relativePath);
		} catch {
			// Skip unreadable / non-CALM files
		}
	}

	// Overlay live editor state for the open diagram (unsaved source edges included).
	const live = options.activeArchitecture;
	if (live && Array.isArray(live.relationships)) {
		const livePath = activePath || '__active__';
		indexNodesFromArchitecture(nodeIndex, live, livePath);
		const existingIdx = indexedFiles.findIndex(
			(f) => normalizeProjectPath(f.relativePath) === livePath
		);
		if (existingIdx >= 0) {
			indexedFiles[existingIdx] = {
				...indexedFiles[existingIdx]!,
				arch: live,
			};
		} else {
			indexedFiles.push({
				relativePath: livePath,
				arch: live,
			});
		}
	}

	const hits: NeighborHit[] = [];
	for (const file of indexedFiles) {
		hits.push(
			...collectNeighborsFromArchitecture(
				file.arch,
				focusUniqueId,
				file.relativePath,
				nodeIndex
			)
		);
	}

	return dedupeNeighborHits(hits);
}
