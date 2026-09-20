// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { selectedDirectoryPath } from '$lib/explorer/folderName';

export type TreeMenuTarget =
	| { kind: 'directory'; path: string }
	| { kind: 'file'; path: string }
	| { kind: 'empty' };

export type TreeMenuAction = 'new-folder' | 'new-file' | 'move';

/** R71 — items for the Files-tree row under the pointer. */
export function treeMenuActions(target: TreeMenuTarget): TreeMenuAction[] {
	if (target.kind === 'directory') return ['new-folder', 'new-file', 'move'];
	return ['new-folder', 'new-file'];
}

/** Directory New folder / New file write into (file row → parent; empty → project root). */
export function treeMenuDirectory(target: TreeMenuTarget): string {
	if (target.kind === 'empty') return '';
	return selectedDirectoryPath(target.path);
}

export function treeMenuShowsMove(target: TreeMenuTarget): boolean {
	return target.kind === 'directory';
}
