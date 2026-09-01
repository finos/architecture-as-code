// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Find usage of a node in other project CALM files (R37).
 * Hits: reference stubs (same unique-id + detailed-architecture) and
 * relationships whose endpoints include the focus id.
 */

import type { CalmArchitecture, CalmRelationship } from '@calmstudio/calm-core';
import { getReferencedNodeIds, getRelationshipVariant } from '@calmstudio/calm-core';
import { scanDirectoryTree } from '$lib/explorer/folderScan';
import { isPathUnderSearchRoots, listJsonFiles } from '$lib/neighbors/findNeighbors';

export type UsageKind = 'node' | 'relationship';

export interface UsageHit {
	rowId: string;
	kind: UsageKind;
	relativePath: string;
	/** Node unique-id or relationship unique-id. */
	uniqueId: string;
	name: string;
	variant?: string;
	nodeType?: string;
}

export interface ScanUsageOptions {
	searchRoots?: string[];
}

function normalizeProjectPath(path: string): string {
	return path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
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

function isReferenceStub(details: unknown): boolean {
	if (!details || typeof details !== 'object') return false;
	const href = (details as Record<string, unknown>)['detailed-architecture'];
	return typeof href === 'string' && href.length > 0;
}

function relationshipName(rel: CalmRelationship): string {
	const extra = rel as CalmRelationship & { name?: string };
	if (typeof extra.name === 'string' && extra.name.trim()) return extra.name;
	return rel['unique-id'];
}

/** Collect usage rows from one architecture (active file already excluded by caller). */
export function collectUsageHits(
	arch: CalmArchitecture,
	focusUniqueId: string,
	relativePath: string
): UsageHit[] {
	const hits: UsageHit[] = [];

	for (const node of arch.nodes) {
		if (node['unique-id'] !== focusUniqueId) continue;
		if (!isReferenceStub(node.details)) continue;
		hits.push({
			rowId: `node:${relativePath}:${node['unique-id']}`,
			kind: 'node',
			relativePath,
			uniqueId: node['unique-id'],
			name: node.name || node['unique-id'],
			nodeType: node['node-type'],
		});
	}

	for (const rel of arch.relationships) {
		const ids = getReferencedNodeIds(rel);
		if (!ids.includes(focusUniqueId)) continue;
		const variant = getRelationshipVariant(rel['relationship-type']);
		hits.push({
			rowId: `rel:${relativePath}:${rel['unique-id']}`,
			kind: 'relationship',
			relativePath,
			uniqueId: rel['unique-id'],
			name: relationshipName(rel),
			variant,
		});
	}

	return hits;
}

/**
 * Scan project CALM files except the active diagram.
 * Honors `neighbors.searchRoots` when provided.
 */
export async function scanProjectUsage(
	root: FileSystemDirectoryHandle,
	focusUniqueId: string,
	activeRelativePath: string | null,
	options: ScanUsageOptions = {}
): Promise<UsageHit[]> {
	const searchRoots = options.searchRoots ?? [];
	const activePath = activeRelativePath ? normalizeProjectPath(activeRelativePath) : null;
	const tree = await scanDirectoryTree(root);
	const files = listJsonFiles(tree).filter((f) => {
		const path = normalizeProjectPath(f.relativePath);
		if (activePath && path === activePath) return false;
		return isPathUnderSearchRoots(f.relativePath, searchRoots);
	});

	const hits: UsageHit[] = [];
	for (const file of files) {
		try {
			const text = await (await file.handle.getFile()).text();
			const arch = parseArchitecture(text);
			if (!arch) continue;
			hits.push(...collectUsageHits(arch, focusUniqueId, file.relativePath));
		} catch {
			// Skip unreadable / non-CALM files
		}
	}
	return hits;
}
