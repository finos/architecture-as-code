// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import type { CalmNodePreview, ExplorerDirectoryEntry, ExplorerFileEntry, ExplorerTreeEntry } from './types';

function joinPath(parent: string, name: string): string {
	return parent ? `${parent}/${name}` : name;
}

/**
 * Recursively scan a directory handle and build a tree of folders and .json files.
 * CALM node previews are loaded lazily via {@link loadCalmNodesForFile}.
 */
export async function scanDirectoryTree(
	dirHandle: FileSystemDirectoryHandle,
	basePath = ''
): Promise<ExplorerTreeEntry[]> {
	const entries: ExplorerTreeEntry[] = [];

	for await (const [name, handle] of dirHandle.entries()) {
		if (name.startsWith('.')) continue;

		if (handle.kind === 'directory') {
			const relativePath = joinPath(basePath, name);
			const children = await scanDirectoryTree(handle as FileSystemDirectoryHandle, relativePath);
			children.sort(compareEntries);
			const dirEntry: ExplorerDirectoryEntry = {
				kind: 'directory',
				name,
				relativePath,
				children,
			};
			entries.push(dirEntry);
			continue;
		}

		if (handle.kind === 'file' && name.toLowerCase().endsWith('.json')) {
			entries.push({
				kind: 'file',
				name,
				relativePath: joinPath(basePath, name),
				handle: handle as FileSystemFileHandle,
				isCalm: false,
				nodesLoaded: false,
			});
		}
	}

	entries.sort(compareEntries);
	return entries;
}

function compareEntries(a: ExplorerTreeEntry, b: ExplorerTreeEntry): number {
	if (a.kind === 'directory' && b.kind === 'file') return -1;
	if (a.kind === 'file' && b.kind === 'directory') return 1;
	return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

export async function loadCalmNodesForFile(file: ExplorerFileEntry): Promise<ExplorerFileEntry> {
	if (file.nodesLoaded) return file;

	try {
		const f = await file.handle.getFile();
		const text = await f.text();
		const parsed = JSON.parse(text) as { nodes?: Array<Record<string, unknown>> };
		if (!Array.isArray(parsed.nodes)) {
			return { ...file, isCalm: false, nodes: [], nodesLoaded: true };
		}

		const nodes: CalmNodePreview[] = parsed.nodes
			.filter((n) => typeof n['unique-id'] === 'string' && typeof n.name === 'string')
			.map((n) => ({
				uniqueId: n['unique-id'] as string,
				name: n.name as string,
				nodeType: typeof n['node-type'] === 'string' ? (n['node-type'] as string) : 'system',
				description:
					typeof n.description === 'string' ? (n.description as string) : '',
			}));

		return { ...file, isCalm: true, nodes, nodesLoaded: true };
	} catch {
		return { ...file, isCalm: false, nodes: [], nodesLoaded: true };
	}
}

export async function readFileContent(file: ExplorerFileEntry): Promise<string> {
	const f = await file.handle.getFile();
	return f.text();
}

/** Find a file entry in the explorer tree by project-relative path. */
export function findFileInTree(
	entries: ExplorerTreeEntry[],
	relativePath: string
): ExplorerFileEntry | null {
	for (const entry of entries) {
		if (entry.kind === 'file' && entry.relativePath === relativePath) {
			return entry;
		}
		if (entry.kind === 'directory') {
			const found = findFileInTree(entry.children, relativePath);
			if (found) return found;
		}
	}
	return null;
}

/** Immutably replace a file entry in the tree by relative path. */
export function updateFileInTree(
	entries: ExplorerTreeEntry[],
	relativePath: string,
	updated: ExplorerFileEntry
): ExplorerTreeEntry[] {
	return entries.map((entry) => {
		if (entry.kind === 'file' && entry.relativePath === relativePath) {
			return updated;
		}
		if (entry.kind === 'directory') {
			return {
				...entry,
				children: updateFileInTree(entry.children, relativePath, updated),
			};
		}
		return entry;
	});
}
