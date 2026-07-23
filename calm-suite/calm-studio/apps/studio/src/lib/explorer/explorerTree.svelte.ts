// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import type { ExplorerTreeEntry } from './types';

let explorerTree = $state<ExplorerTreeEntry[]>([]);

export function setExplorerTree(entries: ExplorerTreeEntry[]): void {
	explorerTree = entries;
}

export function getExplorerTree(): ExplorerTreeEntry[] {
	return explorerTree;
}
