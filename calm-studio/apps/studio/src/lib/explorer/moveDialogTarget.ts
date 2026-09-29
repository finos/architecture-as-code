// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Move dialog destination: typed path plus a project folder tree (R83).
 */

import type { ExplorerDirectoryEntry, ExplorerTreeEntry } from './types';

/** Written into the folder field when the user picks the project root. */
export const PROJECT_ROOT_FIELD = '(project root)';

export interface MoveFolderTreeNode {
	path: string;
	name: string;
	fieldValue: string;
	children: MoveFolderTreeNode[];
}

/** Directories only — nested tree for the move dialog treeview. */
export function buildMoveFolderTree(entries: ExplorerTreeEntry[]): MoveFolderTreeNode[] {
	const children: MoveFolderTreeNode[] = [];
	for (const entry of entries) {
		if (entry.kind !== 'directory') continue;
		children.push(directoryToTreeNode(entry));
	}
	return children;
}

function directoryToTreeNode(entry: ExplorerDirectoryEntry): MoveFolderTreeNode {
	const childDirs: MoveFolderTreeNode[] = [];
	for (const child of entry.children) {
		if (child.kind !== 'directory') continue;
		childDirs.push(directoryToTreeNode(child));
	}
	return {
		path: entry.relativePath,
		name: entry.name,
		fieldValue: entry.relativePath,
		children: childDirs,
	};
}

/** Paths expanded when the dialog opens — every top-level project folder (R83). */
export function defaultExpandedMoveFolderPaths(entries: ExplorerTreeEntry[]): Set<string> {
	const expanded = new Set<string>();
	for (const entry of entries) {
		if (entry.kind === 'directory') expanded.add(entry.relativePath);
	}
	return expanded;
}

/** @deprecated Flat list — prefer {@link buildMoveFolderTree} in the UI. */
export interface MoveFolderChoice {
	path: string;
	name: string;
	depth: number;
	fieldValue: string;
}

export function listProjectFolders(entries: ExplorerTreeEntry[]): MoveFolderChoice[] {
	const out: MoveFolderChoice[] = [
		{ path: '', name: PROJECT_ROOT_FIELD, depth: 0, fieldValue: PROJECT_ROOT_FIELD },
	];
	function walk(nodes: ExplorerTreeEntry[], depth: number): void {
		for (const entry of nodes) {
			if (entry.kind !== 'directory') continue;
			out.push({
				path: entry.relativePath,
				name: entry.name,
				depth,
				fieldValue: entry.relativePath,
			});
			walk(entry.children, depth + 1);
		}
	}
	walk(entries, 1);
	return out;
}

/** Empty, `.`, and the root label all mean the project root. */
export function folderPathFromMoveField(field: string): string {
	const trimmed = field.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
	if (!trimmed || trimmed === '.' || trimmed === PROJECT_ROOT_FIELD) return '';
	return trimmed;
}

/**
 * File move destination. A non-empty folder field replaces the directory and keeps the file name.
 * An empty folder field keeps the path field as the full destination.
 */
export function fileMoveDestination(pathField: string, folderField: string): string {
	let dest = pathField.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
	const folderRaw = folderField.trim();
	if (folderRaw) {
		const name = dest.split('/').pop() ?? dest;
		const folder = folderPathFromMoveField(folderRaw);
		dest = folder ? `${folder}/${name}` : name;
	}
	if (dest && !dest.toLowerCase().endsWith('.json')) dest += '.json';
	return dest;
}
